# Backend Structure

**Sist oppdatert:** 2025-12-01
**Backend versjon:** Refaktorert (app.py: 155 linjer)

## 📁 Directory Organization

```
backend/
├── app.py                           # Flask entrypoint (155 linjer, minimal)
├── function_app.py                  # Azure Functions entrypoint
├── constants.py                     # ⚠️ Deprecated → bruk core/generated_constants.py
├── generated_constants.py           # ⚠️ Deprecated → bruk core/generated_constants.py
│
├── core/                            # Sentralisert konfigurasjon
│   ├── __init__.py
│   ├── config.py                    # Pydantic BaseSettings (85 linjer)
│   ├── constants.py                 # Statiske konstanter (12 linjer)
│   ├── generated_constants.py       # Auto-generert fra shared/status-codes.json (161 linjer)
│   ├── cors_config.py               # CORS-konfigurasjon (40 linjer)
│   ├── logging_config.py            # Sentralisert logging setup (28 linjer)
│   └── system_context.py            # SystemContext - erstatter KOEAutomationSystem (64 linjer)
│
├── routes/                          # Flask Blueprints (HTTP-lag)
│   ├── __init__.py
│   ├── utility_routes.py            # CSRF, health, magic-link (115 linjer)
│   ├── case_routes.py               # Get case, save draft (81 linjer)
│   ├── varsel_routes.py             # Varsel submission (115 linjer)
│   ├── koe_routes.py                # KOE submission, PDF upload (312 linjer)
│   ├── svar_routes.py               # BH svar submission (188 linjer)
│   ├── webhook_routes.py            # Catenda webhook handling (164 linjer)
│   └── error_handlers.py            # Globale feilhåndterere (49 linjer)
│
├── services/                        # Forretningslogikk (framework-agnostisk)
│   ├── __init__.py
│   ├── varsel_service.py            # Varsel business logic (216 linjer)
│   ├── koe_service.py               # KOE business logic (312 linjer)
│   ├── svar_service.py              # BH svar business logic (334 linjer)
│   ├── catenda_service.py           # Catenda API-operasjoner (268 linjer)
│   └── webhook_service.py           # Webhook-håndtering (379 linjer) ← NY
│
├── repositories/                    # Data Access Layer (lagrings-agnostisk)
│   ├── __init__.py
│   ├── base_repository.py           # Abstract interface (111 linjer, 7 metoder)
│   └── csv_repository.py            # CSV-implementasjon for prototype (457 linjer)
│
├── models/                          # Pydantic v2 domenemodeller
│   ├── __init__.py
│   ├── varsel.py                    # Varsel (notification) modell (111 linjer)
│   ├── koe_revisjon.py              # KOE revisjon modell (98 linjer)
│   ├── bh_svar.py                   # Byggherresvar modell (109 linjer)
│   └── sak.py                       # Komplett sak-modell (235 linjer) ← NY
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

### Arkitekturoversikt

```
┌─────────────────────────────────────────────────────────────────┐
│                      HTTP Layer                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Flask Blueprints (routes/)  │  Azure Functions (functions/)││
│  └─────────────────────────────────────────────────────────────┘│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Service Layer (services/)                     │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│  │ VarselService │ │  KoeService   │ │  SvarService  │          │
│  └───────────────┘ └───────────────┘ └───────────────┘          │
│  ┌───────────────┐ ┌───────────────┐                            │
│  │CatendaService │ │WebhookService │                            │
│  └───────────────┘ └───────────────┘                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Data Access Layer (repositories/)              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              BaseRepository (interface)                      ││
│  └─────────────────────────────────────────────────────────────┘│
│       ▲                                        ▲                 │
│  ┌────┴────────────┐              ┌────────────┴────────────┐   │
│  │  CSVRepository  │              │  DataverseRepository    │   │
│  │   (prototype)   │              │     (produksjon)        │   │
│  └─────────────────┘              └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1. **HTTP Layer** (`routes/` og `functions/`)

| Modul | Ansvar | Linjer |
|-------|--------|--------|
| `utility_routes.py` | CSRF, health, magic-link | 115 |
| `case_routes.py` | Get case, save draft | 81 |
| `varsel_routes.py` | Varsel submission | 115 |
| `koe_routes.py` | KOE submission, PDF upload | 312 |
| `svar_routes.py` | BH svar submission | 188 |
| `webhook_routes.py` | Catenda webhooks | 164 |
| `error_handlers.py` | Globale feilhåndterere | 49 |

**Ansvar:**
- Flask Blueprints for modulær ruteorganisering
- Request/response-håndtering
- CSRF-beskyttelse (via `@require_csrf`)
- Rate limiting (via `@limiter.limit()`)
- Mapper HTTP-forespørsler til service-kall

### 2. **Service Layer** (`services/`)

| Service | Ansvar | Linjer |
|---------|--------|--------|
| `varsel_service.py` | Varsel-innsending og validering | 216 |
| `koe_service.py` | KOE-innsending, revisjoner | 312 |
| `svar_service.py` | Byggherresvar-håndtering | 334 |
| `catenda_service.py` | Catenda API-operasjoner | 268 |
| `webhook_service.py` | Webhook event-prosessering | 379 |

**Ansvar:**
- Domenelogikk-implementasjon
- Workflow-orkestrering
- Validering og forretningsregler
- Framework-agnostisk (kan brukes fra Flask OG Azure Functions)

**Dependency Injection:**
```python
class VarselService:
    def __init__(self, repository: BaseRepository = None, catenda_service = None):
        self.repo = repository or CSVRepository()
        self.catenda = catenda_service or CatendaService()
```

### 3. **Data Access Layer** (`repositories/`)

| Repository | Implementasjon | Linjer |
|------------|----------------|--------|
| `base_repository.py` | Abstract interface | 111 |
| `csv_repository.py` | CSV-filer (prototype) | 457 |
| *`dataverse_repository.py`* | *Dataverse (planlagt)* | *-* |

**BaseRepository Interface:**
```python
class BaseRepository(ABC):
    def get_case(self, case_id: str) -> Optional[Dict[str, Any]]
    def update_case(self, case_id: str, data: Dict[str, Any]) -> None
    def create_case(self, case_data: Dict[str, Any]) -> str
    def list_cases(self, project_id: Optional[str] = None) -> List[Dict[str, Any]]
    def delete_case(self, case_id: str) -> None
    def case_exists(self, case_id: str) -> bool
    def get_cases_by_catenda_topic(self, topic_id: str) -> List[Dict[str, Any]]
```

### 4. **Models** (`models/`)

| Modell | Beskrivelse | Linjer |
|--------|-------------|--------|
| `varsel.py` | Varsel (notification) data | 111 |
| `koe_revisjon.py` | KOE revisjon data | 98 |
| `bh_svar.py` | Byggherresvar data | 109 |
| `sak.py` | Komplett sak-modell | 235 |

**Pydantic v2 Features:**
- Automatisk validering
- `model_dump()` / `model_dump_json()` for serialisering
- `@field_validator` for custom validering
- JSON Schema generering

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

## 🔄 Request Flow

### Flask (Prototype)

```
HTTP Request
    ↓
app.py (Flask)
    ↓
routes/*.py (Blueprint)
    ↓
lib/auth/csrf_protection.py (validering)
    ↓
services/*.py (forretningslogikk)
    ↓
repositories/csv_repository.py (datalagring)
    ↓
koe_data/*.json (CSV-filer)
```

### Azure Functions (Produksjon)

```
HTTP Request
    ↓
function_app.py (Azure Functions)
    ↓
functions/adapters.py (request-konvertering)
    ↓
services/*.py (forretningslogikk)
    ↓
repositories/dataverse_repository.py (datalagring)
    ↓
Microsoft Dataverse
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
# Core
# ============================================================================
from core.config import settings
from core.generated_constants import SAK_STATUS, KOE_STATUS
from core.system_context import SystemContext
from core.logging_config import setup_logging
from core.cors_config import setup_cors

# ============================================================================
# Services (Framework-agnostisk forretningslogikk)
# ============================================================================
from services.varsel_service import VarselService
from services.koe_service import KoeService
from services.svar_service import SvarService
from services.catenda_service import CatendaService
from services.webhook_service import WebhookService

# ============================================================================
# Repositories (Data Access)
# ============================================================================
from repositories.base_repository import BaseRepository
from repositories.csv_repository import CSVRepository

# ============================================================================
# Models (Pydantic v2)
# ============================================================================
from models.varsel import Varsel
from models.koe_revisjon import KoeRevisjon
from models.bh_svar import BhSvar
from models.sak import Sak

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
# Library - Monitoring
# ============================================================================
from lib.monitoring.audit import log_event, AuditEventType

# ============================================================================
# Integrations
# ============================================================================
from integrations.catenda import CatendaClient

# ============================================================================
# Utils
# ============================================================================
from utils.logger import get_logger
from utils.filtering_config import get_filter_summary
from utils.network import get_local_ip

# ============================================================================
# Azure Functions Adapters
# ============================================================================
from functions.adapters import adapt_request, create_response
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
