# Arkitekturkvalitet og Azure-utvidbarhet

**Sist oppdatert:** 2026-02-01

Vurdering av backend-arkitekturen med fokus på gjenbrukbarhet, testbarhet og Azure-utvidelse.

---

## Innhold

- [Sammendrag](#sammendrag)
- [Vurdering per område](#vurdering-per-område)
- [Styrker](#styrker)
- [Svakheter](#svakheter)
- [Anbefalte forbedringer](#anbefalte-forbedringer)
- [Prioritert handlingsplan](#prioritert-handlingsplan)

---

## Sammendrag

### Arkitektur-modenhet: ⭐⭐⭐☆☆ (60%)

| Område | Score | Azure-egnet |
|--------|-------|-------------|
| Domain Models | ⭐⭐⭐⭐⭐ | ✅ Utmerket |
| Repository Pattern | ⭐⭐⭐⭐☆ | ✅ God |
| Configuration | ⭐⭐⭐⭐☆ | ⚠️ Trenger utvidelse |
| Service Layer | ⭐⭐⭐☆☆ | ⚠️ Ujevn |
| Dependency Injection | ⭐⭐☆☆☆ | ❌ Primitiv |
| Integrasjoner | ⭐⭐⭐☆☆ | ❌ Flask-avhengig |

### Konklusjon

Kodebasen har et **solid fundament** med gode domenemodeller og repository pattern, men har **teknisk gjeld** i form av hardkodede avhengigheter og Flask-koblinger som hindrer ren Azure-utvidelse.

---

## Vurdering per område

### 1. Domain Models ⭐⭐⭐⭐⭐

**Status:** Utmerket - infrastruktur-uavhengig

```python
# backend/models/events.py - Ren domenelogikk
class SakOpprettetEvent(BaseModel):
    sak_id: str
    sakstype: SaksType
    catenda_topic_id: str
    # ✅ Ingen database-avhengigheter
    # ✅ Ingen HTTP-avhengigheter
    # ✅ CloudEvents v1.0 kompatibel
```

**Styrker:**
- Pydantic BaseModel for strukturert validering
- CloudEvents-format (portabelt)
- Enums for domenebegreper (SaksType, SporStatus, EventType)
- Lett å serialisere til JSON/Cosmos DB/Event Grid

**Azure-egnethet:** ✅ Kan brukes direkte i Azure Functions, Cosmos DB, Service Bus

---

### 2. Repository Pattern ⭐⭐⭐⭐☆

**Status:** God factory-pattern, men begrenset scope

```python
# backend/repositories/__init__.py
def create_event_repository(backend: str | None = None) -> EventRepository:
    if backend is None:
        backend = os.environ.get("EVENT_STORE_BACKEND", "json")

    if backend == "json":
        return JsonFileEventRepository()
    elif backend == "supabase":
        return SupabaseEventRepository()
    # ✅ Lett å legge til azure_sql, cosmos_db, etc.
```

**Hierarki:**
```
EventRepository (abstrakt interface)
├── JsonFileEventRepository (lokal utvikling)
├── SupabaseEventRepository (dev/test)
├── AzureSqlEventRepository (fremtidig)
└── CosmosDbEventRepository (fremtidig)
```

**Styrker:**
- Abstrakt interface gjør backend-bytte enkelt
- Miljøvariabel-basert valg
- Konsistent API på tvers av implementasjoner

**Svakheter:**
- Mangler transaction-støtte i interface
- Mangler generisk query-interface
- Begrenset til CRUD-operasjoner

**Azure-egnethet:** ✅ God - ny repository kan legges til uten å endre forretningslogikk

---

### 3. Configuration ⭐⭐⭐⭐☆

**Status:** God Pydantic Settings, mangler Azure-spesifikk config

```python
# backend/core/config.py
class Settings(BaseSettings):
    # Catenda API
    catenda_client_id: str = ""
    catenda_client_secret: str = ""

    # Repository
    repository_type: str = "csv"  # csv|supabase|dataverse

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False
    )
```

**Styrker:**
- Type-sikker (Pydantic v2)
- Sentralisert konfigurasjon
- `.env` auto-load
- `repository_type` gjør backend-bytte mulig

**Mangler:**
```python
# Disse bør legges til for Azure
azure_storage_connection: str = ""
azure_service_bus_connection: str = ""
azure_keyvault_url: str = ""
azure_sql_connection: str = ""
```

**Azure-egnethet:** ⚠️ Fungerer, men trenger utvidelse

---

### 4. Service Layer ⭐⭐⭐☆☆

**Status:** Ujevn DI-strategi

**God praksis (TimelineService):**
```python
class TimelineService:
    def __init__(self):
        pass  # Ingen avhengigheter

    def compute_state(self, events: List[AnyEvent]) -> SakState:
        # Pure function - lett å teste og gjenbruke
```

**Bedre praksis (ForseringService):**
```python
class ForseringService(BaseSakService):
    def __init__(
        self,
        catenda_client: Optional[Any] = None,
        event_repository: Optional[Any] = None,
        timeline_service: Optional[Any] = None,
    ):
        # Løst koblet - kan testes med mock
```

**Problem (global singletons i routes):**
```python
# backend/routes/event_routes.py
event_repo = create_event_repository()    # Global!
timeline_service = TimelineService()       # Global!
```

**Azure-problem:** Globale singletons er problematiske i serverless - hver Function-instans kan ha ulik tilstand.

**Azure-egnethet:** ⚠️ TimelineService fungerer, men global state må fjernes

---

### 5. Dependency Injection ⭐⭐☆☆☆

**Status:** Primitiv - hardkodede imports

```python
# backend/functions/adapters.py - ServiceContext
class ServiceContext:
    @property
    def event_repository(self):
        if self._event_repository is None:
            from repositories import create_event_repository  # ❌ Hardkodet
            self._event_repository = create_event_repository()
        return self._event_repository
```

**Problemer:**
- Imports er hardkodet i properties
- Ingen DI-container
- Vanskelig å injisere test doubles
- Circular import-risiko

**Azure-egnethet:** ❌ Må refaktoreres for testbarhet og fleksibilitet

---

### 6. Integrasjoner (Catenda) ⭐⭐⭐☆☆

**Status:** Bærbar client, men Flask-avhengig auth

**God praksis (CatendaClient):**
```python
# backend/integrations/catenda/client.py
class CatendaClient:
    def __init__(self, access_token: str, project_id: str):
        self.session = requests.Session()  # ✅ Bærbar
```

**Problem (auth.py):**
```python
# backend/integrations/catenda/auth.py
from flask import request, jsonify, g  # ❌ Flask-spesifikt!
from app import get_system             # ❌ Flask app coupling!
```

**Konsekvens:** Auth-modulen fungerer IKKE i Azure Functions.

**Azure-egnethet:** ❌ auth.py må refaktoreres til framework-agnostisk

---

## Styrker

### 1. Event Sourcing er godt implementert

```
Events → TimelineService.compute_state() → SakState
         (pure function)
```

- Immutable events
- State beregnes alltid fra events
- Lett å replay, teste, debugge

### 2. Repository Pattern muliggjør backend-bytte

```bash
# Bytte fra Supabase til Azure SQL:
EVENT_STORE_BACKEND=azure_sql
# Ingen kodeendringer i forretningslogikk!
```

### 3. CloudEvents v1.0 er fremtidssikret

- CNCF-standard
- Native Azure Event Grid-støtte
- SDK-er for alle språk

### 4. Pydantic-modeller er selvdokumenterende

```python
class GrunnlagData(BaseModel):
    tittel: str = Field(..., description="Tittel på grunnlaget")
    hovedkategori: str = Field(..., description="SVIKT, ENDRING, etc.")
```

---

## Svakheter

### 1. Flask-avhengigheter blokkerer Azure

| Fil | Problem |
|-----|---------|
| `integrations/catenda/auth.py` | `from flask import request, g` |
| `routes/*.py` | Global singletons |
| `app.py` | `get_system()` coupling |

### 2. Ingen ekte DI-container

```python
# Nåværende: Hardkodede imports
from repositories import create_event_repository

# Ønsket: Injisert avhengighet
def __init__(self, event_repo: EventRepository):
    self.event_repo = event_repo
```

### 3. Manglende transaction-støtte i repository

```python
# Nåværende: To separate operasjoner
metadata_repo.create(metadata)
event_repo.append(event)  # Kan feile etter metadata er lagret!

# Ønsket: Atomisk operasjon
with uow.transaction():
    uow.metadata.create(metadata)
    uow.events.append(event)
    uow.commit()
```

### 4. Threading i background tasks

```python
# backend/services/webhook_service.py
thread = threading.Thread(target=self._sync_to_catenda)
thread.start()  # ❌ Fungerer IKKE i Azure Functions!
```

---

## Anbefalte forbedringer

### 1. DI Container (Prioritet: Høy)

**Ny fil:** `backend/core/container.py`

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class Container:
    """Dependency injection container"""
    config: Settings
    _event_repo: Optional[EventRepository] = None
    _timeline_service: Optional[TimelineService] = None
    _catenda_client: Optional[CatendaClient] = None

    @property
    def event_repository(self) -> EventRepository:
        if self._event_repo is None:
            backend = self.config.event_store_backend
            if backend == "supabase":
                self._event_repo = SupabaseEventRepository()
            elif backend == "azure_sql":
                self._event_repo = AzureSqlEventRepository(
                    self.config.azure_sql_connection
                )
        return self._event_repo

    @property
    def timeline_service(self) -> TimelineService:
        if self._timeline_service is None:
            self._timeline_service = TimelineService()
        return self._timeline_service

    def get_forsering_service(self) -> ForseringService:
        return ForseringService(
            event_repository=self.event_repository,
            timeline_service=self.timeline_service,
            catenda_client=self.catenda_client
        )

# Bruk i Azure Functions
def my_function(req):
    container = Container(config=settings)
    service = container.get_forsering_service()
    result = service.process(req)
```

**Fordeler:**
- Testbar (kan injisere mock)
- Lazy loading (opprettes kun ved behov)
- Sentralisert avhengighetshåndtering

---

### 2. Framework-agnostisk auth (Prioritet: Høy)

**Refaktor:** `backend/integrations/catenda/auth.py`

```python
# FØR (Flask-avhengig)
from flask import request, g

# ETTER (Framework-agnostisk)
class TokenManager:
    def __init__(self, token_store: TokenStore, config: Settings):
        self.token_store = token_store  # Abstrakt interface
        self.config = config

    async def get_valid_token(self) -> str:
        stored = await self.token_store.get("catenda")
        if self._is_valid(stored):
            return stored["access_token"]

        new_token = await self._refresh_token()
        await self.token_store.set("catenda", new_token)
        return new_token["access_token"]

# Implementasjoner
class InMemoryTokenStore(TokenStore):
    """For testing"""

class RedisTokenStore(TokenStore):
    """For Flask/produksjon"""

class CosmosTokenStore(TokenStore):
    """For Azure Functions"""
```

---

### 3. Unit of Work for transaksjoner (Prioritet: Medium)

**Ny fil:** `backend/core/unit_of_work.py`

```python
from abc import ABC, abstractmethod

class UnitOfWork(ABC):
    events: EventRepository
    metadata: MetadataRepository

    @abstractmethod
    def __enter__(self) -> "UnitOfWork":
        pass

    @abstractmethod
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.rollback()

    @abstractmethod
    def commit(self):
        pass

    @abstractmethod
    def rollback(self):
        pass

class PostgresUnitOfWork(UnitOfWork):
    def __init__(self, connection_string: str):
        self.conn = psycopg2.connect(connection_string)

    def __enter__(self):
        self.conn.autocommit = False
        self.events = PostgresEventRepository(self.conn)
        self.metadata = PostgresMetadataRepository(self.conn)
        return self

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()
```

---

### 4. Azure-spesifikk konfigurasjon (Prioritet: Medium)

**Utvid:** `backend/core/config.py`

```python
class Settings(BaseSettings):
    # Eksisterende...

    # Azure Storage
    azure_storage_account: str = ""
    azure_storage_key: str = ""
    azure_storage_container: str = "koe-documents"

    # Azure Service Bus
    azure_service_bus_connection: str = ""
    azure_queue_name: str = "koe-events"

    # Azure SQL
    azure_sql_connection: str = ""

    # Azure Key Vault
    azure_keyvault_url: str = ""

    @property
    def is_azure_environment(self) -> bool:
        return bool(self.azure_keyvault_url)
```

---

## Prioritert handlingsplan

### Fase 1: Fjern blokkere (8-12 timer)

| # | Oppgave | Fil | Estimat |
|---|---------|-----|---------|
| 1.1 | Opprett DI Container | `core/container.py` | 4 timer |
| 1.2 | Refaktor auth.py - fjern Flask | `integrations/catenda/auth.py` | 4 timer |
| 1.3 | Fjern globale singletons i routes | `routes/*.py` | 2 timer |
| 1.4 | Oppdater ServiceContext | `functions/adapters.py` | 2 timer |

### Fase 2: Forbedre robusthet (8-12 timer)

| # | Oppgave | Fil | Estimat |
|---|---------|-----|---------|
| 2.1 | Implementer Unit of Work | `core/unit_of_work.py` | 4 timer |
| 2.2 | Utvid repository interface | `repositories/base.py` | 2 timer |
| 2.3 | Legg til Azure config | `core/config.py` | 2 timer |
| 2.4 | Fjern threading i services | `services/webhook_service.py` | 4 timer |

### Fase 3: Azure-spesifikke implementasjoner (16-24 timer)

| # | Oppgave | Fil | Estimat |
|---|---------|-----|---------|
| 3.1 | AzureSqlEventRepository | `repositories/azure_sql.py` | 8 timer |
| 3.2 | Azure Service Bus integration | `services/queue_service.py` | 8 timer |
| 3.3 | Azure Key Vault for secrets | `core/secrets.py` | 4 timer |
| 3.4 | CosmosTokenStore | `integrations/catenda/stores.py` | 4 timer |

**Total estimat:** 32-48 timer

---

## Se også

- [AZURE_READINESS.md](AZURE_READINESS.md) - Status og handlingsplan for Azure-deploy
- [DATABASE_ARCHITECTURE.md](../backend/docs/DATABASE_ARCHITECTURE.md) - Database-valg og transaksjoner
- [backend/STRUCTURE.md](../backend/STRUCTURE.md) - Backend-mappestruktur
