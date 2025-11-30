# Backend Structure

## 📁 Directory Organization

```
backend/
├── app.py                       # Flask application entry point
├── constants.py                 # ⚠️  Deprecated (use core/generated_constants.py)
│
├── core/                        # Core configuration and constants
│   ├── config.py               # Application configuration
│   └── generated_constants.py  # Auto-generated from shared/status-codes.json
│
├── integrations/                # External API integrations
│   └── catenda/
│       ├── client.py           # CatendaClient (Catenda API integration)
│       └── auth.py             # Catenda authentication helpers
│
├── lib/                         # Reusable library components
│   ├── auth/                   # Authentication & authorization
│   │   ├── csrf_protection.py  # CSRF token handling
│   │   └── magic_link.py       # Magic link token management
│   ├── security/               # Security utilities
│   │   ├── validation.py       # Input validation
│   │   └── webhook_security.py # Webhook signature verification
│   └── monitoring/             # Monitoring and audit
│       └── audit.py            # Audit logging
│
├── models/                      # Pydantic data models
│   ├── varsel.py               # Varsel (notification) model
│   ├── koe_revisjon.py         # KOE revision model
│   └── bh_svar.py              # BH response model
│
├── repositories/                # Data access layer
│   ├── base_repository.py      # Base repository interface
│   └── csv_repository.py       # CSV-based repository implementation
│
├── services/                    # Business logic layer
│   ├── catenda_service.py      # Catenda API service
│   ├── varsel_service.py       # Varsel business logic
│   ├── koe_service.py          # KOE business logic
│   └── svar_service.py         # BH svar business logic
│
├── routes/                      # Flask blueprints (HTTP layer)
│   ├── utility_routes.py       # Utility endpoints (CSRF, health, etc.)
│   ├── case_routes.py          # Case management endpoints
│   ├── varsel_routes.py        # Varsel submission
│   ├── koe_routes.py           # KOE submission and revision
│   ├── svar_routes.py          # BH svar submission
│   └── webhook_routes.py       # Catenda webhook handling
│
├── scripts/                     # CLI tools and setup scripts
│   ├── catenda_menu.py         # Interactive Catenda API menu
│   ├── webhook_listener.py     # Webhook listener (development)
│   ├── setup_authentication.py # Catenda auth setup
│   └── setup_webhooks.py       # Webhook configuration
│
├── utils/                       # Utility functions
│   ├── logger.py               # Logging configuration
│   └── filtering_config.py     # Data filtering configuration
│
└── tests/                       # Test suite
    ├── conftest.py             # pytest fixtures
    ├── fixtures/               # Test data
    ├── test_models/            # Model tests
    ├── test_repositories/      # Repository tests
    ├── test_services/          # Service tests (business logic)
    └── test_routes/            # Route tests (integration)
```

## 🏗️ Architecture Layers

### 1. **HTTP Layer** (`routes/`)
- Flask Blueprints for modular route organization
- Request/response handling
- CSRF protection
- Maps HTTP requests to service calls

### 2. **Business Logic Layer** (`services/`)
- Domain logic implementation
- Workflow orchestration
- Validation and business rules
- Uses repositories for data access

### 3. **Data Access Layer** (`repositories/`)
- Abstract data storage/retrieval
- Repository pattern for testability
- Currently: CSVRepository
- Future: DataverseRepository

### 4. **Models** (`models/`)
- Pydantic v2 data models
- Validation and serialization
- Type safety

### 5. **External Integrations** (`integrations/`)
- Third-party API clients
- Catenda API integration
- Future: Dataverse, etc.

### 6. **Library Components** (`lib/`)
- Reusable utilities
- Authentication (CSRF, magic links)
- Security (validation, webhooks)
- Monitoring (audit logs)

## 🔄 Request Flow

```
HTTP Request
    ↓
routes/ (Flask Blueprint)
    ↓
services/ (Business Logic)
    ↓
repositories/ (Data Access)
    ↓
Data Storage (CSV / Dataverse)
```

## 📦 Key Components

### CatendaClient (`integrations/catenda/client.py`)
- Production-ready Catenda API client
- Handles authentication (OAuth 2.0)
- BCF v3.0 and REST v2 API support
- Comment posting, document upload, webhook management

### Repository Pattern (`repositories/`)
- `BaseRepository`: Abstract interface
- `CSVRepository`: CSV-based implementation
- Future: `DataverseRepository` for Microsoft Dataverse

### Service Layer (`services/`)
- Clean separation of business logic
- Testable (dependency injection)
- Orchestrates repository + external API calls

## 🧪 Testing

All layers are tested:
- **Integration tests**: `tests/test_routes/` (HTTP layer)
- **Unit tests**: `tests/test_services/` (business logic)
- **Repository tests**: `tests/test_repositories/` (data access)

Run tests:
```bash
python -m pytest tests/ -v
```

## 📝 Import Examples

```python
# Core
from core.generated_constants import SAK_STATUS, KOE_STATUS

# Integrations
from integrations.catenda import CatendaClient

# Library
from lib.auth import require_csrf, MagicLinkManager
from lib.security.validation import validate_email
from lib.monitoring.audit import log_event

# Repositories
from repositories.csv_repository import CSVRepository

# Services
from services.varsel_service import VarselService
```

## 🚀 Future Enhancements

1. **Dataverse Integration** (`integrations/dataverse/`)
2. **Azure Functions Deployment** (separate routing layer)
3. **Additional Repositories** (SQL, NoSQL)
4. **Enhanced Monitoring** (Application Insights)

---

For migration details, see [MIGRATION.md](./MIGRATION.md)
