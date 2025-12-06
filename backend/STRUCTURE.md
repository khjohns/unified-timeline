# Backend Structure

**Sist oppdatert:** 2025-12-06
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
│   ├── constants.py                 # Statiske konstanter
│   ├── generated_constants.py       # Auto-generert fra shared/status-codes.json
│   ├── cors_config.py               # CORS-konfigurasjon
│   └── logging_config.py            # Sentralisert logging setup
│
├── models/                          # Pydantic v2 domenemodeller (EVENT SOURCING)
│   ├── __init__.py
│   ├── events.py                    # 🆕 Event-definisjoner (933 linjer)
│   │                                # - SakEvent (base)
│   │                                # - GrunnlagData, VederlagData, FristData
│   │                                # - GrunnlagResponsData, VederlagResponsData, FristResponsData
│   │                                # - EventType enum
│   └── sak_state.py                 # 🆕 Read model/projeksjon (562 linjer)
│                                    # - SakState (aggregate root)
│                                    # - GrunnlagTilstand, VederlagTilstand, FristTilstand
│                                    # - Beregnede felter, subsidiary-logikk
│
├── repositories/                    # Data Access Layer (EVENT STORE)
│   ├── __init__.py
│   ├── event_repository.py          # 🆕 Event store (190 linjer)
│   │                                # - JsonFileEventRepository
│   │                                # - Optimistisk låsing (versjonsnummer)
│   │                                # - Atomic batch operations
│   │                                # - File locking (fcntl)
│   └── sak_metadata_repository.py   # 🆕 Metadata-cache for sakliste (134 linjer)
│
├── services/                        # Forretningslogikk (CQRS)
│   ├── __init__.py
│   ├── timeline_service.py          # 🆕 State-projeksjon (753 linjer)
│   │                                # - compute_state(events) → SakState
│   │                                # - Event handlers (reducers)
│   │                                # - Tre-spor koordinering
│   ├── business_rules.py            # 🆕 Forretningsregler (240 linjer)
│   │                                # - BusinessRuleValidator
│   │                                # - Regler per event-type
│   │                                # - Validering før persistering
│   └── catenda_service.py           # Catenda API-operasjoner
│
├── routes/                          # Flask Blueprints (HTTP-lag)
│   ├── __init__.py
│   ├── event_routes.py              # 🆕 Event API (592 linjer)
│   │                                # - POST /api/events (submit event)
│   │                                # - GET /api/cases/{id}/state
│   │                                # - GET /api/cases/{id}/timeline
│   ├── utility_routes.py            # CSRF, health, magic-link
│   ├── webhook_routes.py            # Catenda webhook handling
│   └── error_handlers.py            # Globale feilhåndterere
│
├── lib/                             # Gjenbrukbare bibliotekskomponenter
│   ├── __init__.py
│   ├── auth/                        # Autentisering og autorisasjon
│   │   ├── __init__.py
│   │   ├── csrf_protection.py       # CSRF token-håndtering (244 linjer)
│   │   └── magic_link.py            # Magic link tokens (105 linjer)
│   ├── security/                    # Sikkerhetsverktøy
│   │   ├── __init__.py
│   │   ├── validation.py            # Input-validering (472 linjer)
│   │   ├── webhook_security.py      # Webhook-verifisering (265 linjer)
│   │   └── rate_limiter.py          # Rate limiting setup (113 linjer) ← NY
│   └── monitoring/                  # Overvåking og revisjon
│       ├── __init__.py
│       └── audit.py                 # Audit logging (377 linjer)
│
├── integrations/                    # Eksterne API-integrasjoner
│   └── catenda/
│       ├── __init__.py
│       ├── client.py                # CatendaClient (1649 linjer)
│       └── auth.py                  # OAuth autentisering (534 linjer)
│
├── functions/                       # Azure Functions adapter
│   ├── __init__.py
│   └── adapters.py                  # Request/response adapters (214 linjer)
│
├── utils/                           # Utility-funksjoner
│   ├── __init__.py
│   ├── logger.py                    # Logging-helpers (67 linjer)
│   ├── filtering_config.py          # Datafiltrering (265 linjer)
│   └── network.py                   # Nettverkshelpers (30 linjer) ← NY
│
├── scripts/                         # CLI-verktøy og setup-scripts
│   ├── __init__.py
│   ├── catenda_menu.py              # Interaktiv Catenda-meny (998 linjer)
│   ├── webhook_listener.py          # Webhook-lytter (utvikling) (369 linjer)
│   ├── setup_authentication.py      # Catenda auth setup (421 linjer)
│   ├── setup_webhooks.py            # Webhook-konfigurasjon (532 linjer)
│   ├── manual_testing.sh            # Bash script for API-testing
│   └── KOE_Backend_API.postman_collection.json  # Postman collection
│
└── tests/                           # Testsuite (379 tester, 62% coverage)
    ├── __init__.py
    ├── conftest.py                  # pytest fixtures
    ├── fixtures/                    # Testdata
    │   └── __init__.py
    ├── test_models/                 # Modelltester
    │   ├── __init__.py
    │   └── test_sak.py              # 30 tester (100% coverage)
    ├── test_repositories/           # Repository-tester
    │   ├── __init__.py
    │   └── test_csv_repository.py   # 91% coverage
    ├── test_services/               # Service-tester (forretningslogikk)
    │   ├── __init__.py
    │   ├── test_varsel_service.py
    │   ├── test_koe_service.py
    │   ├── test_svar_service.py
    │   ├── test_catenda_service.py
    │   └── test_webhook_service.py
    ├── test_routes/                 # Route-tester (integrasjon)
    │   ├── __init__.py
    │   ├── test_case_routes.py
    │   ├── test_utility_routes.py
    │   └── test_workflow_routes.py
    ├── test_security/               # Sikkerhetstester
    │   ├── __init__.py
    │   ├── test_csrf.py
    │   ├── test_magic_link.py
    │   ├── test_validation.py       # 93 tester (95% coverage)
    │   └── test_webhook.py
    ├── test_monitoring/             # Overvåkingstester
    │   ├── __init__.py
    │   └── test_audit.py            # 38 tester (79% coverage)
    └── test_utils/                  # Utility-tester
        ├── __init__.py
        ├── test_filtering_config.py # 30 tester (100% coverage)
        ├── test_logger.py           # 19 tester (100% coverage)
        └── test_network.py          # 12 tester (100% coverage)
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

| Modul | Ansvar | Linjer |
|-------|--------|--------|
| `event_routes.py` | **Event API (CQRS)** | 592 |
| `utility_routes.py` | CSRF, health, magic-link | 115 |
| `webhook_routes.py` | Catenda webhooks | 164 |
| `error_handlers.py` | Globale feilhåndterere | 49 |

**Ansvar:**
- Flask Blueprints for modulær ruteorganisering
- **Write Side:** POST /api/events (event submission)
- **Read Side:** GET /api/cases/{id}/state, GET /api/cases/{id}/timeline
- CSRF-beskyttelse, Rate limiting
- Optimistisk låsing via `expected_version`

### 2. **Service Layer** (`services/`)

| Service | Ansvar | Linjer |
|---------|--------|--------|
| `timeline_service.py` | **State-projeksjon fra events** | 753 |
| `business_rules.py` | **Forretningsregler-validering** | 240 |
| `catenda_service.py` | Catenda API-operasjoner | 268 |

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

| Repository | Implementasjon | Linjer |
|------------|----------------|--------|
| `event_repository.py` | **Event store med optimistisk låsing** | 190 |
| `sak_metadata_repository.py` | Metadata-cache for sakliste | 134 |

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

| Modell | Beskrivelse | Linjer |
|--------|-------------|--------|
| `events.py` | **Event-definisjoner** | 933 |
| `sak_state.py` | **Read model (projeksjon)** | 562 |

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

| Modul | Ansvar | Linjer |
|-------|--------|--------|
| `config.py` | Pydantic BaseSettings (miljøvariabler) | 85 |
| `generated_constants.py` | Statuskoder (auto-generert) | 161 |
| `system_context.py` | SystemContext for legacy-kompatibilitet | 64 |
| `cors_config.py` | CORS-oppsett | 40 |
| `logging_config.py` | Sentralisert logging | 28 |
| `constants.py` | Statiske konstanter | 12 |

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
| Modul | Ansvar | Linjer |
|-------|--------|--------|
| `csrf_protection.py` | CSRF tokens med HMAC-signering | 244 |
| `magic_link.py` | Sikre magic link tokens | 105 |

#### Security (`lib/security/`)
| Modul | Ansvar | Linjer |
|-------|--------|--------|
| `validation.py` | Input-validering (GUID, email, etc.) | 472 |
| `webhook_security.py` | Webhook-verifisering | 265 |
| `rate_limiter.py` | Flask-Limiter setup | 113 |

#### Monitoring (`lib/monitoring/`)
| Modul | Ansvar | Linjer |
|-------|--------|--------|
| `audit.py` | Audit logging | 377 |

### 7. **External Integrations** (`integrations/`)

| Modul | Ansvar | Linjer |
|-------|--------|--------|
| `catenda/client.py` | Catenda REST + BCF v3.0 API | 1649 |
| `catenda/auth.py` | OAuth 2.0 autentisering | 534 |

### 8. **Azure Functions** (`functions/`)

| Modul | Ansvar | Linjer |
|-------|--------|--------|
| `adapters.py` | Azure Functions → Service layer adapter | 214 |

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

### Test Coverage (2025-12-01)

| Kategori | Tester | Coverage |
|----------|--------|----------|
| Services | 5 filer | 83-93% |
| Routes | 3 filer | 91-100% |
| Repositories | 1 fil | 91% |
| Security | 4 filer | 79-95% |
| Models | 1 fil | 100% |
| Monitoring | 1 fil | 79% |
| Utils | 3 filer | 100% |
| **Totalt** | **379 tester** | **62%** |

### Kjør tester

```bash
# Alle tester
python -m pytest tests/ -v

# Med coverage
python -m pytest tests/ --cov=. --cov-report=html

# Spesifikk kategori
python -m pytest tests/test_services/ -v

# Manuell API-testing
./scripts/manual_testing.sh
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

## 📊 Metrics

### Kode-statistikk

| Kategori | Filer | Total linjer |
|----------|-------|--------------|
| Core | 6 | ~400 |
| Routes | 7 | ~1,024 |
| Services | 5 | ~1,509 |
| Repositories | 2 | ~568 |
| Models | 4 | ~553 |
| Lib | 7 | ~1,576 |
| Integrations | 2 | ~2,183 |
| Utils | 3 | ~362 |
| Scripts | 4 | ~2,320 |
| Functions | 1 | ~214 |
| Tests | 18 | ~3,000+ |
| **Totalt** | **59** | **~13,700** |

### Refaktoreringsresultat

| Før | Etter | Reduksjon |
|-----|-------|-----------|
| `app.py`: 1231 linjer | `app.py`: 155 linjer | **87%** |
| Alt i én fil | 7 routes + 5 services | Modulær |
| Tett koblet | Dependency injection | Testbar |

---

## Se også

- [DEPLOYMENT.md](../docs/DEPLOYMENT.md) - Deployment-guide
- [API.md](../docs/API.md) - API-referanse
- [Refaktoreringsplan - Backend.md](../docs/Refaktoreringsplan%20-%20Backend.md) - Detaljert refaktoreringsplan
- [PRE_PRODUCTION_PLAN.md](../docs/PRE_PRODUCTION_PLAN.md) - Pre-produksjon sjekkliste
