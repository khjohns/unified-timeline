# Backend Structure

**Sist oppdatert:** 2026-01-14
**Backend versjon:** Event Sourcing + CQRS

## 📁 Directory Organization

```
backend/
├── app.py                           # Flask entrypoint
├── function_app.py                  # Azure Functions entrypoint
│
├── core/                            # Sentralisert konfigurasjon
│   ├── __init__.py
│   ├── config.py                    # Pydantic BaseSettings
│   ├── cors_config.py               # CORS-konfigurasjon
│   └── logging_config.py            # Sentralisert logging setup
│
├── constants/                       # Forretningskonstanter
│   ├── __init__.py
│   ├── grunnlag_categories.py       # NS 8407 kategorier
│   └── vederlag_methods.py          # Vederlagsmetoder
│
├── models/                          # Pydantic v2 domenemodeller (EVENT SOURCING)
│   ├── __init__.py
│   ├── events.py                    # Event-definisjoner (SakEvent, EventType, *Data)
│   ├── sak_state.py                 # Read model/projeksjon (SakState, *Tilstand)
│   ├── api_responses.py             # API response DTOs
│   ├── sak_metadata.py              # Metadata for sakliste
│   └── cloudevents.py               # CloudEvents mixin og konvertering
│
├── repositories/                    # Data Access Layer (EVENT STORE)
│   ├── __init__.py
│   ├── base_repository.py           # Repository interface
│   ├── event_repository.py          # Event store med optimistisk låsing
│   ├── sak_metadata_repository.py   # Metadata-cache for sakliste
│   └── supabase_event_repository.py # Supabase implementasjon
│
├── services/                        # Forretningslogikk (CQRS)
│   ├── __init__.py
│   ├── timeline_service.py          # State-projeksjon
│   ├── business_rules.py            # Forretningsregler-validering
│   ├── forsering_service.py         # Forsering §33.8 logikk
│   ├── endringsordre_service.py     # Endringsordre §31.3 logikk
│   ├── related_cases_service.py     # Relaterte saker
│   ├── catenda_service.py           # Catenda API-operasjoner
│   ├── catenda_comment_generator.py # Kommentar-generering
│   ├── webhook_service.py           # Webhook-håndtering
│   └── letter_pdf_generator.py      # PDF-generering (ReportLab)
│
├── routes/                          # Flask Blueprints (HTTP-lag)
│   ├── __init__.py
│   ├── event_routes.py              # Event API
│   ├── forsering_routes.py          # Forsering §33.8 API
│   ├── endringsordre_routes.py      # Endringsordre §31.3 API
│   ├── sync_routes.py               # Dalux sync API
│   ├── utility_routes.py            # CSRF, health, magic-link
│   ├── webhook_routes.py            # Catenda webhook handling
│   ├── cloudevents_routes.py        # CloudEvents schema API
│   └── error_handlers.py            # Globale feilhåndterere
│
├── lib/                             # Gjenbrukbare bibliotekskomponenter
│   ├── __init__.py
│   ├── auth/                        # Autentisering og autorisasjon
│   │   ├── __init__.py
│   │   ├── csrf_protection.py       # CSRF token-håndtering
│   │   └── magic_link.py            # Magic link tokens
│   ├── cloudevents/                 # CloudEvents v1.0 støtte (CNCF)
│   │   ├── __init__.py
│   │   ├── schemas.py               # JSON Schema for event-typer
│   │   └── http_binding.py          # HTTP binding og serialisering
│   ├── security/                    # Sikkerhetsverktøy
│   │   ├── __init__.py
│   │   ├── validation.py            # Input-validering
│   │   ├── webhook_security.py      # Webhook-verifisering
│   │   └── rate_limiter.py          # Rate limiting setup
│   └── monitoring/                  # Overvåking og revisjon
│       ├── __init__.py
│       └── audit.py                 # Audit logging
│
├── integrations/                    # Eksterne API-integrasjoner
│   ├── catenda/
│   │   ├── __init__.py
│   │   ├── client.py                # CatendaClient
│   │   └── auth.py                  # OAuth autentisering
│   └── dalux/
│       ├── __init__.py
│       └── client.py                # DaluxClient
│
├── functions/                       # Azure Functions adapter
│   ├── __init__.py
│   └── adapters.py                  # Request/response adapters
│
├── utils/                           # Utility-funksjoner
│   ├── __init__.py
│   ├── logger.py                    # Logging-helpers
│   ├── filtering_config.py          # Datafiltrering
│   └── network.py                   # Nettverkshelpers
│
├── scripts/                         # CLI-verktøy og setup-scripts
│   ├── __init__.py
│   ├── catenda_menu.py              # Interaktiv Catenda-meny
│   ├── create_test_sak.py           # Opprett testdata
│   ├── setup_authentication.py      # Catenda auth setup
│   ├── setup_webhooks.py            # Webhook-konfigurasjon
│   └── webhook_listener.py          # Webhook-lytter (utvikling)
│
└── tests/                           # Testsuite (~600 tester)
    ├── __init__.py
    ├── conftest.py                  # pytest fixtures
    ├── fixtures/                    # Testdata
    │   └── __init__.py
    ├── test_auth/                   # Auth-tester
    │   ├── test_magic_link_decorator.py
    │   └── test_session_based_magic_links.py
    ├── test_models/                 # Modelltester
    │   ├── test_events.py           # Event modell-tester
    │   ├── test_event_parsing.py    # Event parsing-tester
    │   └── test_cloudevents.py      # CloudEvents modell-tester
    ├── test_api/                    # API-tester
    │   └── test_cloudevents_api.py  # CloudEvents API-tester
    ├── test_repositories/           # Repository-tester
    │   ├── test_event_repository.py # Event store-tester
    │   └── test_sak_metadata_repository.py
    ├── test_services/               # Service-tester (forretningslogikk)
    │   ├── test_business_rules.py
    │   └── test_catenda_service.py
    ├── test_security/               # Sikkerhetstester
    │   ├── test_csrf.py
    │   ├── test_magic_link.py
    │   ├── test_validation.py
    │   └── test_webhook.py
    ├── test_monitoring/             # Overvåkingstester
    │   └── test_audit.py
    └── test_utils/                  # Utility-tester
        ├── test_filtering_config.py
        ├── test_logger.py
        └── test_network.py
```

---

## 🏗️ Architecture Layers

### Event Sourcing + CQRS Arkitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                      HTTP Layer (routes/)                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    event_routes.py                           ││
│  │  POST /api/events          GET /api/cases/{id}/state         ││
│  │  (Write Side)              (Read Side)                       ││
│  └─────────────────────────────────────────────────────────────┘│
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         │                                       │
         ▼                                       ▼
┌─────────────────────────┐       ┌─────────────────────────────┐
│    WRITE SIDE           │       │      READ SIDE              │
│ ┌─────────────────────┐ │       │ ┌─────────────────────────┐ │
│ │ BusinessRuleValidator│ │       │ │   TimelineService       │ │
│ │ • Valider event     │ │       │ │   • compute_state()     │ │
│ │ • Sjekk forretnings-│ │       │ │   • Event handlers      │ │
│ │   regler            │ │       │ │   • Tre-spor projeksjon │ │
│ └─────────────────────┘ │       │ └─────────────────────────┘ │
│           │             │       │             ▲               │
│           ▼             │       │             │               │
│ ┌─────────────────────┐ │       │             │               │
│ │  EventRepository    │ │       │             │               │
│ │  • append(event)    │─┼───────┼─────────────┘               │
│ │  • get_events()     │ │       │                             │
│ │  • Optimistisk lås  │ │       │                             │
│ └─────────────────────┘ │       │                             │
└─────────────────────────┘       └─────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EVENT STORE                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  JsonFileEventRepository (prototype)                         ││
│  │  • JSON-fil per sak                                          ││
│  │  • Versjonsnummer for optimistisk låsing                     ││
│  │  • File locking (fcntl) for atomiske operasjoner             ││
│  └─────────────────────────────────────────────────────────────┘│
│       ▲                                                          │
│  ┌────┴────────────────────────────────────────────────────┐    │
│  │  DataverseEventRepository (produksjon - planlagt)       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Tre-spor modell (NS 8407)

```
SakState (Aggregate Root)
│
├── GrunnlagTilstand
│   ├── status: SporStatus
│   ├── hovedkategori, underkategori, beskrivelse
│   ├── bh_resultat: GrunnlagResponsResultat
│   └── laast: boolean
│
├── VederlagTilstand
│   ├── status: SporStatus
│   ├── krevd_belop, metode, begrunnelse
│   ├── Port 1: varsel-vurdering (rigg_drift_ok, justert_ep_ok, ...)
│   ├── Port 2: bh_resultat, godkjent_belop
│   └── visningsstatus (med subsidiary-logikk)
│
└── FristTilstand
    ├── status: SporStatus
    ├── krevd_dager, varsel_type, begrunnelse
    ├── Port 1: noytralt_varsel_ok, spesifisert_krav_ok
    ├── Port 2: vilkar_oppfylt
    ├── Port 3: bh_resultat, godkjent_dager
    └── visningsstatus (med subsidiary-logikk)
```

### 1. **HTTP Layer** (`routes/`)

| Modul | Ansvar |
|-------|--------|
| `event_routes.py` | Event API (CQRS) |
| `forsering_routes.py` | Forsering API (§33.8) |
| `endringsordre_routes.py` | Endringsordre API (§31.3) |
| `sync_routes.py` | Dalux sync API |
| `utility_routes.py` | CSRF, health, magic-link |
| `webhook_routes.py` | Catenda webhooks |
| `cloudevents_routes.py` | CloudEvents schema API |
| `error_handlers.py` | Globale feilhåndterere |

**Ansvar:**
- Flask Blueprints for modulær ruteorganisering
- **Write Side:** POST /api/events (event submission)
- **Read Side:** GET /api/cases/{id}/state, GET /api/cases/{id}/timeline
- **CloudEvents:** GET /api/cloudevents/schemas, GET /api/cloudevents/schemas/{type}
- **Forsering:** POST /api/forsering/opprett, GET /api/forsering/{id}/kontekst
- **Endringsordre:** POST /api/endringsordre/opprett, POST /api/endringsordre/{id}/koe
- CSRF-beskyttelse, Rate limiting, Optimistisk låsing

### 2. **Service Layer** (`services/`)

| Service | Ansvar |
|---------|--------|
| `timeline_service.py` | State-projeksjon fra events |
| `endringsordre_service.py` | Endringsordre §31.3 logikk |
| `forsering_service.py` | Forsering §33.8 logikk |
| `webhook_service.py` | Webhook-håndtering |
| `business_rules.py` | Forretningsregler-validering |
| `catenda_service.py` | Catenda API-operasjoner |
| `related_cases_service.py` | Relaterte saker |

**TimelineService (Projector):**
```python
class TimelineService:
    def compute_state(self, events: List[SakEvent]) -> SakState:
        """Projiser events til SakState via reducer-pattern."""
        state = SakState.empty()
        for event in sorted(events, key=lambda e: e.tidsstempel):
            state = self._apply_event(state, event)
        return state

    def _apply_event(self, state: SakState, event: SakEvent) -> SakState:
        """Dispatch til riktig handler basert på event_type."""
        handlers = {
            EventType.GRUNNLAG_OPPRETTET: self._handle_grunnlag,
            EventType.VEDERLAG_KRAV_SENDT: self._handle_vederlag,
            EventType.RESPONS_GRUNNLAG: self._handle_respons_grunnlag,
            # ... flere handlers
        }
        return handlers[event.event_type](state, event)
```

**BusinessRuleValidator:**
```python
class BusinessRuleValidator:
    def validate(self, event: SakEvent, state: SakState) -> ValidationResult:
        """Valider event mot nåværende state før persistering."""
        rules = self._get_rules_for_event_type(event.event_type)
        for rule in rules:
            result = rule(event, state)
            if not result.is_valid:
                return result
        return ValidationResult.ok()
```

### 3. **Data Access Layer** (`repositories/`)

| Repository | Implementasjon |
|------------|----------------|
| `event_repository.py` | Event store med optimistisk låsing |
| `supabase_event_repository.py` | Supabase implementasjon |
| `sak_metadata_repository.py` | Metadata-cache for sakliste |
| `base_repository.py` | Repository interface |

**EventRepository Interface:**
```python
class EventRepository(ABC):
    def append(self, event: SakEvent, expected_version: int) -> int:
        """Legg til event med optimistisk låsing. Returnerer ny versjon."""

    def append_batch(self, events: List[SakEvent], expected_version: int) -> int:
        """Atomisk batch-operasjon for flere events."""

    def get_events(self, sak_id: str) -> Tuple[List[SakEvent], int]:
        """Hent alle events for sak, returnerer (events, version)."""
```

**Optimistisk låsing:**
```python
# Ved konflikt kastes ConcurrencyError
try:
    new_version = repo.append(event, expected_version=5)
except ConcurrencyError as e:
    # Returnerer 409 Conflict til klient med faktisk versjon
    return {"error": "conflict", "actual_version": e.actual_version}
```

### 4. **Models** (`models/`)

| Modell | Beskrivelse |
|--------|-------------|
| `events.py` | Event-definisjoner |
| `sak_state.py` | Read model (projeksjon) |
| `api_responses.py` | API response DTOs |
| `sak_metadata.py` | Metadata for sakliste |
| `cloudevents.py` | CloudEvents mixin og konvertering |

**Event-modeller (Pydantic v2):**
```python
class SakEvent(BaseModel):
    event_id: UUID
    sak_id: str
    event_type: EventType
    tidsstempel: datetime
    aktor: str
    aktor_rolle: Literal["TE", "BH"]
    data: Union[GrunnlagData, VederlagData, FristData, ...]
    kommentar: Optional[str] = None
    referrer_til_event_id: Optional[UUID] = None

class GrunnlagData(BaseModel):
    hovedkategori: str
    underkategori: List[str]
    beskrivelse: str
    dato_oppdaget: date
    # ...

class VederlagData(BaseModel):
    krav_belop: Decimal
    metode: VederlagMetode
    # Port 1 varsler
    rigg_drift_varsel: Optional[VarselInfo]
    justert_ep_varsel: Optional[VarselInfo]
    # ...
```

### 5. **Core Configuration** (`core/`)

| Modul | Ansvar |
|-------|--------|
| `config.py` | Pydantic BaseSettings (miljøvariabler) |
| `generated_constants.py` | Statuskoder (auto-generert) |
| `system_context.py` | SystemContext for legacy-kompatibilitet |
| `cors_config.py` | CORS-oppsett |
| `logging_config.py` | Sentralisert logging |
| `constants.py` | Statiske konstanter |

**Sentralisert konfigurasjon:**
```python
from core.config import settings

# Alle miljøvariabler tilgjengelig via settings
print(settings.catenda_client_id)
print(settings.cors_origins)
print(settings.rate_limit_per_hour)
```

### 6. **Library Components** (`lib/`)

#### Auth (`lib/auth/`)
| Modul | Ansvar |
|-------|--------|
| `csrf_protection.py` | CSRF tokens med HMAC-signering |
| `magic_link.py` | Sikre magic link tokens |

#### CloudEvents (`lib/cloudevents/`)
| Modul | Ansvar |
|-------|--------|
| `schemas.py` | JSON Schema-generering for alle event-typer |
| `http_binding.py` | CloudEvents HTTP binding og serialisering |

#### Security (`lib/security/`)
| Modul | Ansvar |
|-------|--------|
| `validation.py` | Input-validering (GUID, email, etc.) |
| `webhook_security.py` | Webhook-verifisering |
| `rate_limiter.py` | Flask-Limiter setup |

#### Monitoring (`lib/monitoring/`)
| Modul | Ansvar |
|-------|--------|
| `audit.py` | Audit logging |

### 7. **External Integrations** (`integrations/`)

| Modul | Ansvar |
|-------|--------|
| `catenda/client.py` | Catenda REST + BCF v3.0 API |
| `catenda/auth.py` | OAuth 2.0 autentisering |
| `dalux/client.py` | Dalux FM API |

### 8. **Azure Functions** (`functions/`)

| Modul | Ansvar |
|-------|--------|
| `adapters.py` | Azure Functions → Service layer adapter |

**Adapter-pattern:**
```python
def adapt_request(req: func.HttpRequest) -> Dict[str, Any]:
    """Konverter Azure Functions request til dict"""
    return {
        'json': req.get_json(),
        'args': dict(req.params),
        'headers': dict(req.headers),
        'method': req.method,
    }
```

---

## 🔄 Request Flow (Event Sourcing)

### Write Flow (POST /api/events)

```
HTTP Request (event + expected_version)
    ↓
event_routes.py
    ↓
1. Parse event fra request
    ↓
2. Hent nåværende events fra EventRepository
    ↓
3. Sjekk versjon (optimistisk låsing)
    ↓                      ↓
   OK                   KONFLIKT → 409 Conflict
    ↓
4. Beregn nåværende state (TimelineService)
    ↓
5. Valider forretningsregler (BusinessRuleValidator)
    ↓                      ↓
   OK                   UGYLDIG → 400 Bad Request
    ↓
6. Persist event (EventRepository.append)
    ↓
7. Beregn ny state
    ↓
8. Oppdater metadata-cache
    ↓
9. (Valgfritt) Post til Catenda
    ↓
Response: { event_id, new_version, state }
```

### Read Flow (GET /api/cases/{id}/state)

```
HTTP Request
    ↓
event_routes.py
    ↓
1. Hent events fra EventRepository
    ↓
2. Projiser til SakState (TimelineService.compute_state)
    ↓
Response: { state, version, events_count }
```

### Event Store (Prototype vs Produksjon)

```
Prototype:                        Produksjon:
────────────                      ────────────
JsonFileEventRepository           DataverseEventRepository
    ↓                                 ↓
koe_data/{sak_id}.json            Microsoft Dataverse
• version: number                 • koe_events tabell
• events: [...]                   • Optimistisk låsing via ETag
```

---

## 📦 Key Components

### SystemContext (`core/system_context.py`)

Forenklet systemkontekst for legacy route-kompatibilitet:

```python
class SystemContext:
    """
    Gir tilgang til:
    - db: CSVRepository (data access)
    - catenda: CatendaClient (Catenda API)
    - get_react_app_base_url(): React app URL helper
    """
    def __init__(self, config: Dict[str, Any]):
        self.db = CSVRepository(config.get('data_dir', 'koe_data'))
        self.catenda = CatendaClient(...)
```

### Settings (`core/config.py`)

Pydantic BaseSettings for type-validert konfigurasjon:

```python
class Settings(BaseSettings):
    # Catenda
    catenda_client_id: str = ""
    catenda_client_secret: str = ""

    # Security
    csrf_secret_key: str = "dev-secret"
    webhook_secret_path: str = ""

    # Rate limiting
    rate_limit_per_day: str = "200 per day"
    rate_limit_per_hour: str = "50 per hour"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False
    )
```

### CatendaClient (`integrations/catenda/client.py`)

Produksjonsklar Catenda API-klient:

- OAuth 2.0 autentisering (client credentials + user tokens)
- BCF v3.0 API (topics, comments, documents)
- REST v2 API (projects, members, webhooks)
- Automatisk token-refresh

---

## 🧪 Testing

### Kjør tester

```bash
# Alle tester
python -m pytest tests/ -v

# Med coverage
python -m pytest tests/ --cov=. --cov-report=html

# Spesifikk kategori
python -m pytest tests/test_services/ -v
```

---

## 📝 Import Examples

```python
# ============================================================================
# Event Sourcing - Models
# ============================================================================
from models.events import (
    SakEvent,
    EventType,
    GrunnlagData,
    VederlagData,
    FristData,
    GrunnlagResponsData,
    VederlagResponsData,
    FristResponsData,
)
from models.sak_state import (
    SakState,
    GrunnlagTilstand,
    VederlagTilstand,
    FristTilstand,
    SporStatus,
    OverordnetStatus,
)

# ============================================================================
# Event Sourcing - Repository
# ============================================================================
from repositories.event_repository import (
    EventRepository,
    JsonFileEventRepository,
    ConcurrencyError,
)
from repositories.sak_metadata_repository import SakMetadataRepository

# ============================================================================
# Event Sourcing - Services
# ============================================================================
from services.timeline_service import TimelineService
from services.business_rules import BusinessRuleValidator, ValidationResult
from services.catenda_service import CatendaService

# ============================================================================
# Core
# ============================================================================
from core.config import settings
from core.generated_constants import SAK_STATUS, SPOR_STATUS
from core.logging_config import setup_logging
from core.cors_config import setup_cors

# ============================================================================
# Library - Auth
# ============================================================================
from lib.auth.csrf_protection import require_csrf, generate_csrf_token
from lib.auth.magic_link import MagicLinkManager

# ============================================================================
# Library - Security
# ============================================================================
from lib.security.validation import validate_email, validate_guid
from lib.security.webhook_security import validate_webhook_event
from lib.security.rate_limiter import init_limiter, get_limiter

# ============================================================================
# Integrations
# ============================================================================
from integrations.catenda import CatendaClient

# ============================================================================
# Utils
# ============================================================================
from utils.logger import get_logger
```

---

## 🚀 Future Enhancements

### Planlagt

1. **DataverseRepository** (`repositories/dataverse_repository.py`)
   - Microsoft Dataverse integration
   - Samme interface som CSVRepository

2. **Azure Functions Production**
   - `function_app.py` med alle triggers
   - Azure Service Bus for async operasjoner

### Mulige utvidelser

3. **Additional Repositories**
   - SQL (Azure SQL Database)
   - NoSQL (Cosmos DB)

4. **Enhanced Monitoring**
   - Azure Application Insights
   - Structured JSON logging
   - Custom metrics

5. **Caching**
   - Redis for rate limiting
   - Session state

---

## Se også

- [DEPLOYMENT.md](../docs/DEPLOYMENT.md) - Deployment-guide
- [API.md](docs/API.md) - API-referanse
- [openapi.yaml](docs/openapi.yaml) - OpenAPI-spesifikasjon
