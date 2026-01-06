# Database-arkitektur og Transaksjoner

> Sist oppdatert: 2026-01-06

## Innhold

1. [Nåværende arkitektur](#nåværende-arkitektur)
2. [Begrensninger og risiko](#begrensninger-og-risiko)
3. [Produksjons-alternativer](#produksjons-alternativer)
4. [Anbefalte mønstre](#anbefalte-mønstre)
5. [Implementasjonsguide](#implementasjonsguide)
6. [Anbefaling](#anbefaling)

---

## Nåværende arkitektur

### Event Sourcing med Supabase

Backend bruker Event Sourcing-arkitektur der alle tilstandsendringer lagres som uforanderlige events:

```
┌─────────────────┐     ┌─────────────────┐
│  sak_metadata   │────▶│   koe_events    │
│  (case info)    │ FK  │  (event log)    │
└─────────────────┘     └─────────────────┘
```

**Tabeller:**
- `sak_metadata` - Metadata og cache for saker (sak_id, prosjekt_id, cached_status, etc.)
- `koe_events` - Event log for standard KOE-saker
- `forsering_events` - Event log for forseringssaker
- `endringsordre_events` - Event log for endringsordrer

### Foreign Key Constraint

Database har FK constraint som sikrer referanseintegritet:

```sql
ALTER TABLE koe_events
ADD CONSTRAINT fk_koe_events_sak
FOREIGN KEY (sak_id) REFERENCES sak_metadata(sak_id);
```

**Konsekvens:** Metadata MÅ opprettes FØR events kan lagres.

### Nåværende flyt ved saksopprettelse

```python
# 1. Opprett metadata FØRST (FK constraint krever dette)
metadata = SakMetadata(sak_id=sak_id, ...)
metadata_repo.create(metadata)

# 2. Opprett event
event = SakOpprettetEvent(sak_id=sak_id, ...)
try:
    event_repo.append(event, expected_version=0)
except Exception:
    # 3. Manuell rollback ved feil
    metadata_repo.delete(sak_id)
    raise
```

### Repository Pattern

Backend bruker factory-funksjoner for å velge riktig backend basert på miljøvariabler:

```python
# Konfigurasjon via miljøvariabler
EVENT_STORE_BACKEND=supabase     # eller "json"
METADATA_STORE_BACKEND=supabase  # eller "csv"

# Factory-funksjoner
from repositories import create_event_repository, create_metadata_repository

event_repo = create_event_repository()      # Returnerer SupabaseEventRepository
metadata_repo = create_metadata_repository() # Returnerer SupabaseSakMetadataRepository
```

---

## Begrensninger og risiko

### 1. Supabase mangler native transaksjoner

Supabase Python-klienten støtter IKKE client-side transaksjoner. PostgREST (som Supabase bruker) har bevisst valgt å ikke implementere dette pga. risiko for langvarige database-låser.

**Referanse:** [GitHub Discussion #526](https://github.com/orgs/supabase/discussions/526)

### 2. Ikke atomisk operasjon

Nåværende kode utfører to separate database-operasjoner:

```python
metadata_repo.create(metadata)  # Operasjon 1
event_repo.append(event)        # Operasjon 2
```

**Risikoer:**
- Hvis appen krasjer mellom steg 1 og 2: orphaned metadata
- Hvis event-insert feiler og rollback feiler: inkonsistent tilstand
- Nettverksfeil kan forhindre rollback

### 3. Event Sourcing-prinsipp invertert

I ren Event Sourcing er events kilden til sannhet, og projeksjoner (metadata) deriveres FRA events:

```
Tradisjonelt:  Events → (projection) → Metadata
Nåværende:     Metadata → Events (FK krever metadata først)
```

Dette bryter med Event Sourcing-filosofien, men gir bedre dataintegritet i et system uten ekte transaksjoner.

### 4. Rollback er skjør

```python
except Exception:
    try:
        metadata_repo.delete(sak_id)  # Kan også feile
    except Exception:
        pass  # Stille feil = potensielt inkonsistent tilstand
```

---

## Produksjons-alternativer

### Azure SQL Database

**Egenskaper:**
- Full ACID-transaksjonsstøtte
- Høy tilgjengelighet og skalerbarhet
- Integrert med Azure-økosystemet
- Støtter pyodbc, SQLAlchemy

**Transaksjonsstøtte:**
```python
import pyodbc

conn = pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
conn.autocommit = False

try:
    cursor = conn.cursor()
    cursor.execute("INSERT INTO sak_metadata ...")
    cursor.execute("INSERT INTO koe_events ...")
    conn.commit()  # Atomisk
except:
    conn.rollback()
finally:
    conn.close()
```

**Vurdering:** Beste valg for tradisjonell relasjonsdatabase med full transaksjonsstøtte.

### Azure Database for PostgreSQL

**Egenskaper:**
- Full ACID-transaksjonsstøtte
- PostgreSQL-kompatibel (enklere migrering fra Supabase)
- Managed service med automatisk backup
- Støtter psycopg2, asyncpg, SQLAlchemy

**Transaksjonsstøtte:**
```python
import psycopg2

conn = psycopg2.connect(AZURE_POSTGRES_CONNECTION_STRING)
try:
    with conn.cursor() as cur:
        cur.execute("INSERT INTO sak_metadata ...")
        cur.execute("INSERT INTO koe_events ...")
    conn.commit()  # Atomisk
except:
    conn.rollback()
```

**Vurdering:** God kompatibilitet med eksisterende Supabase-skjema. Enklest migrasjon.

### Microsoft Dataverse

**Egenskaper:**
- Integrert med Power Platform og Dynamics 365
- Ikke en tradisjonell SQL-database
- Begrenset transaksjonsstøtte (batch operations)
- Bruker Web API eller SDK

**Transaksjonsstøtte:**
```python
# Dataverse støtter ExecuteTransactionRequest for batch
from dataverse_api import DataverseClient

client = DataverseClient(...)
batch = client.create_batch()
batch.create("sak_metadata", metadata)
batch.create("koe_events", event)
result = batch.execute()  # Alt-eller-ingenting, men ikke ekte ACID
```

**Begrensninger:**
- Maks 1000 operasjoner per batch
- Ikke ekte rollback (kompensasjon kreves)
- Annerledes datamodell (entities, ikke tabeller)

**Vurdering:** Egnet hvis integrasjon med Power Platform er viktig. Krever betydelig refaktorering.

### Sammenligning

| Egenskap | Supabase | Azure SQL | Azure PostgreSQL | Dataverse |
|----------|----------|-----------|------------------|-----------|
| ACID-transaksjoner | ❌ | ✅ | ✅ | ⚠️ Batch |
| PostgreSQL-kompatibel | ✅ | ❌ | ✅ | ❌ |
| Migreringskompleksitet | - | Medium | Lav | Høy |
| Power Platform-integrasjon | ❌ | ⚠️ | ⚠️ | ✅ |
| Pris (estimat) | Lav | Medium | Medium | Høy |

---

## Anbefalte mønstre

### 1. Repository Pattern (Implementert)

Allerede på plass med factory-funksjoner:

```python
# repositories/__init__.py
def create_event_repository(backend: str | None = None):
    if backend is None:
        backend = os.environ.get("EVENT_STORE_BACKEND", "json")

    if backend == "json":
        return JsonFileEventRepository()
    elif backend == "supabase":
        return SupabaseEventRepository()
    elif backend == "azure_sql":
        return AzureSqlEventRepository()  # Fremtidig
    # ...
```

### 2. Unit of Work Pattern (Anbefalt for produksjon)

Abstraherer transaksjonslogikk på tvers av backends:

```python
# core/unit_of_work.py
from abc import ABC, abstractmethod

class UnitOfWork(ABC):
    """Abstrakt Unit of Work for transaksjoner."""

    event_repo: EventRepository
    metadata_repo: MetadataRepository

    @abstractmethod
    def __enter__(self) -> "UnitOfWork":
        """Start transaksjon."""
        pass

    @abstractmethod
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Avslutt og håndter rollback ved feil."""
        pass

    @abstractmethod
    def commit(self):
        """Commit alle endringer atomisk."""
        pass

    @abstractmethod
    def rollback(self):
        """Rollback alle endringer."""
        pass


class AzureSqlUnitOfWork(UnitOfWork):
    """Azure SQL implementasjon med ekte transaksjoner."""

    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self._connection = None

    def __enter__(self):
        self._connection = pyodbc.connect(self.connection_string)
        self._connection.autocommit = False
        self.event_repo = AzureSqlEventRepository(self._connection)
        self.metadata_repo = AzureSqlMetadataRepository(self._connection)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.rollback()
        self._connection.close()

    def commit(self):
        self._connection.commit()

    def rollback(self):
        self._connection.rollback()


class SupabaseUnitOfWork(UnitOfWork):
    """Supabase implementasjon (best-effort, ikke ekte transaksjon)."""

    def __enter__(self):
        self.event_repo = SupabaseEventRepository()
        self.metadata_repo = SupabaseMetadataRepository()
        self._pending_metadata = []
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.rollback()

    def commit(self):
        # Best-effort: metadata først, deretter events
        for metadata in self._pending_metadata:
            self.metadata_repo.create(metadata)

    def rollback(self):
        # Manuell rollback
        for metadata in self._pending_metadata:
            try:
                self.metadata_repo.delete(metadata.sak_id)
            except:
                pass


# Factory
def create_unit_of_work() -> UnitOfWork:
    backend = os.environ.get("DATABASE_BACKEND", "supabase")

    if backend == "azure_sql":
        return AzureSqlUnitOfWork(os.environ["AZURE_SQL_CONNECTION_STRING"])
    elif backend == "azure_postgres":
        return AzurePostgresUnitOfWork(os.environ["AZURE_POSTGRES_CONNECTION_STRING"])
    else:
        return SupabaseUnitOfWork()
```

**Bruk i kode:**

```python
# services/webhook_service.py
def handle_new_topic_created(self, payload):
    with create_unit_of_work() as uow:
        # Opprett metadata
        metadata = SakMetadata(sak_id=sak_id, ...)
        uow.metadata_repo.create(metadata)

        # Opprett event
        event = SakOpprettetEvent(sak_id=sak_id, ...)
        uow.event_repo.append(event, expected_version=0)

        # Commit atomisk (eller rollback ved feil)
        uow.commit()
```

### 3. Eventual Consistency (For Dataverse)

Hvis Dataverse velges, bør arkitekturen endres til eventual consistency:

```python
# Fjern FK constraint
# Events kan opprettes uten at metadata finnes

# Async worker/trigger oppretter metadata
async def ensure_metadata_exists(event):
    if not metadata_repo.exists(event.sak_id):
        metadata = derive_metadata_from_event(event)
        metadata_repo.upsert(metadata)
```

---

## Implementasjonsguide

### Steg 1: Definer abstraksjoner (Nå)

Lag interface for Unit of Work:

```python
# core/unit_of_work.py
class UnitOfWork(ABC):
    # ... (se over)
```

### Steg 2: Implementer for Supabase (Nå)

Wrap eksisterende logikk i UoW:

```python
class SupabaseUnitOfWork(UnitOfWork):
    # Best-effort implementasjon
```

### Steg 3: Implementer for produksjons-backend (Når valgt)

```python
class AzureSqlUnitOfWork(UnitOfWork):
    # Ekte ACID-transaksjoner

class DataverseUnitOfWork(UnitOfWork):
    # Batch operations med kompensasjon
```

### Steg 4: Oppdater services (Inkrementelt)

Refaktorer services til å bruke UoW:

```python
# Før
metadata_repo.create(metadata)
event_repo.append(event)

# Etter
with create_unit_of_work() as uow:
    uow.metadata_repo.create(metadata)
    uow.event_repo.append(event)
    uow.commit()
```

### Miljøvariabler

```bash
# Prototype (Supabase)
DATABASE_BACKEND=supabase
EVENT_STORE_BACKEND=supabase
METADATA_STORE_BACKEND=supabase

# Produksjon (Azure SQL)
DATABASE_BACKEND=azure_sql
AZURE_SQL_CONNECTION_STRING=Driver={ODBC Driver 18 for SQL Server};Server=...

# Produksjon (Azure PostgreSQL)
DATABASE_BACKEND=azure_postgres
AZURE_POSTGRES_CONNECTION_STRING=postgresql://user:pass@host:5432/db

# Produksjon (Dataverse)
DATABASE_BACKEND=dataverse
DATAVERSE_URL=https://org.crm.dynamics.com
DATAVERSE_CLIENT_ID=...
DATAVERSE_CLIENT_SECRET=...
```

---

## Anbefaling

### For MVP/Prototype (Nå)

- **Behold nåværende løsning** med Supabase
- FK constraint gir akseptabel dataintegritet
- Manuell rollback håndterer de fleste feilscenarier
- Risiko akseptabel for prototype

### For Produksjon

| Hvis backend er... | Anbefaling |
|--------------------|------------|
| **Azure SQL** | Implementer Unit of Work med ekte transaksjoner |
| **Azure PostgreSQL** | Implementer Unit of Work + behol eksisterende skjema |
| **Dataverse** | Vurder eventual consistency, fjern FK constraint |

### Prioritert rekkefølge

1. **Azure PostgreSQL** - Enklest migrering, full transaksjonsstøtte
2. **Azure SQL** - God transaksjonsstøtte, krever noe skjema-tilpasning
3. **Dataverse** - Kun hvis Power Platform-integrasjon er kritisk

---

## Referanser

- [Supabase Transaction Discussion](https://github.com/orgs/supabase/discussions/526)
- [Unit of Work Pattern](https://martinfowler.com/eaaCatalog/unitOfWork.html)
- [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Azure SQL Documentation](https://docs.microsoft.com/azure/azure-sql/)
- [Dataverse Web API](https://docs.microsoft.com/powerapps/developer/data-platform/webapi/)
