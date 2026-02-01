# Deployment Guide

**Sist oppdatert:** 2026-02-01

Veiledning for utrulling av Unified Timeline (KOE-system) til produksjon.

---

## Innhold

- [Oversikt](#oversikt)
- [Arkitektur](#arkitektur)
- [Frontend: Azure Static Web Apps](#frontend-azure-static-web-apps)
- [Backend: Azure Functions](#backend-azure-functions)
- [Database: PostgreSQL (Supabase/Azure)](#database-postgresql)
- [Event-format: CloudEvents](#event-format-cloudevents)
- [Azure Event Grid (fremtidig)](#azure-event-grid-fremtidig)
- [Sikkerhet](#sikkerhet)
- [Autentisering: IDA og Entra ID](#autentisering-ida-og-entra-id)
- [Miljøvariabler](#miljøvariabler)
- [CI/CD Pipeline](#cicd-pipeline)
- [Overvåkning](#overvåkning)
- [Sjekkliste](#sjekkliste)
- [Vedlegg: SharePoint-vurdering](#vedlegg-sharepoint-vurdering)

---

## Oversikt

### Prototype vs. Produksjon

| Aspekt | Prototype (Dev) | Produksjon |
|--------|-----------------|------------|
| Frontend | Vite dev server | Azure Static Web Apps |
| Backend | Flask (Python) | Azure Functions (Python) |
| Database | Supabase (PostgreSQL) | Azure PostgreSQL (anbefalt) |
| Event-format | CloudEvents v1.0 | CloudEvents v1.0 |
| Arkitektur | Event Sourcing + CQRS | Event Sourcing + CQRS |
| Autentisering | Magic links / Supabase Auth | Magic links + Entra ID |
| Sikkerhet | Basis CSRF/CORS | WAF, DDoS, RLS |
| Hosting | Lokal / Vercel+Render | Azure |

> **Merk:** Supabase brukes kun for utvikling. For produksjon anbefales Azure PostgreSQL.
> Se [DATABASE_ARCHITECTURE.md](../backend/docs/DATABASE_ARCHITECTURE.md) for detaljer.

### Produksjonsmiljø

```
                                    ┌──────────────────┐
                                    │    Bruker        │
                                    │  (Ekstern/       │
                                    │   Intern)        │
                                    └────────┬─────────┘
                                             │
                                             ▼
                              ┌──────────────────────────────┐
                              │  Azure Front Door + WAF      │
                              │  - DDoS Protection           │
                              │  - Rate Limiting             │
                              │  - Geo-filtering             │
                              └──────────────┬───────────────┘
                                             │
                                             ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    Azure Static Web Apps                              │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                     React Frontend                              │  │
│  │  - React 19 + TypeScript                                        │  │
│  │  - Punkt (Oslo kommunes designsystem)                           │  │
│  │  - Client-side PDF-generering (@react-pdf)                      │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │ HTTPS/REST
                                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│                      Azure Functions (Python 3.11)                    │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Forretningslogikk og API-lag                                    │ │
│  │  - Event Sourcing (CloudEvents v1.0)                             │ │
│  │  - Gatekeeper (autorisasjon + rollebasert tilgang)               │ │
│  │  - Input-validering (UUID, felt-validering)                      │ │
│  │  - Magic Link-håndtering                                         │ │
│  │  - Webhook-mottak fra Catenda                                    │ │
│  │  - Optimistisk låsing (versjonskontroll)                         │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───────────────┬───────────────────────────────────┬───────────────────┘
                │                                   │
                │ psycopg2/SQLAlchemy               │ HTTPS
                ▼                                   ▼
┌───────────────────────────────┐    ┌──────────────────────────────────┐
│  Azure PostgreSQL             │    │           Catenda                │
│  (Event Store)                │    │  ┌────────────────────────────┐  │
│  ┌─────────────────────────┐  │    │  │  - Webhook (inn)           │  │
│  │  - koe_events           │  │    │  │  - Document API v2         │  │
│  │  - forsering_events     │  │    │  │  - BCF 3.0 API             │  │
│  │  - endringsordre_events │  │    │  │  - Project Members         │  │
│  │  - sak_metadata         │  │    │  └────────────────────────────┘  │
│  │  - magic_links          │  │    │  Autoritativ dokument-kilde      │
│  └─────────────────────────┘  │    └──────────────────────────────────┘
│  ACID Transactions            │
│  Row-Level Security           │             ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│  Encryption at rest           │               Azure Event Grid
└───────────────────────────────┘             │ (fremtidig mulighet)  │
                │                              - Retry ved feil
                │ Azure Synapse Link          │ - Fan-out til Power BI│
                ▼                              - Dead-letter queue
┌───────────────────────────────┐             └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
│        Power BI               │
│  - Rapporter                  │
│  - Dashboards                 │
│  - Analyse                    │
└───────────────────────────────┘

        ┌──────────────────────────────────────┐
        │  Microsoft 365 Økosystem             │
        │  ┌────────────────────────────────┐  │
        │  │  Entra ID (SSO, MFA)           │  │
        │  │  Microsoft Graph API           │  │
        │  │  Key Vault (Secrets)           │  │
        │  │  Application Insights          │  │
        │  └────────────────────────────────┘  │
        └──────────────────────────────────────┘
```

---

## Frontend: Azure Static Web Apps

### Konfigurasjon

Azure Static Web Apps (SWA) hoster React-applikasjonen som statiske filer.

#### `staticwebapp.config.json`

Opprett fil i rot-mappen:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/assets/*"]
  },
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["anonymous"]
    }
  ],
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.azurewebsites.net"
  },
  "mimeTypes": {
    ".json": "application/json"
  }
}
```

### Bygging

```bash
# Bygg for produksjon
npm run build

# Output i /dist mappen
```

### Miljøvariabler

I Azure Portal → Static Web App → Configuration:

| Variabel | Verdi | Beskrivelse |
|----------|-------|-------------|
| `VITE_API_BASE_URL` | `https://<function-app>.azurewebsites.net/api` | Backend API URL |

### Deploy-kommando

```bash
# Med Azure CLI
az staticwebapp create \
  --name koe-frontend \
  --resource-group koe-rg \
  --source ./dist \
  --location "West Europe"
```

---

## Backend: Azure Functions

### Struktur for Azure Functions

Backend er delvis klargjort for Azure Functions. Eksisterende struktur:

```
backend/
├── function_app.py           # ✅ Azure Functions entry point (eksisterer)
├── host.json                 # ✅ Host konfigurasjon (eksisterer)
├── local.settings.json       # Lokale innstillinger (kopieres fra template)
├── requirements.txt          # ✅ Python avhengigheter
│
├── functions/                # ✅ Azure Functions adapters (delvis implementert)
│   ├── adapters.py           # ✅ Request/response adapters, ServiceContext
│   └── __init__.py
│
├── core/                     # ✅ Konfigurasjon (ferdig)
│   ├── config.py             # Settings via Pydantic
│   └── system_context.py     # Dependency injection
│
├── services/                 # ✅ Forretningslogikk (ferdig)
│   ├── timeline_service.py   # State-projeksjon fra events
│   └── ...
├── repositories/             # ✅ Event Sourcing
│   ├── event_repository.py   # Abstrakt interface + JSON-fil impl (prototype)
│   ├── supabase_event_repository.py  # Supabase/PostgreSQL impl (produksjon)
│   └── csv_repository.py     # ⚠️ Deprecated (kun bakoverkompatibilitet)
├── integrations/             # ✅ Catenda client (ferdig)
├── lib/                      # ✅ Sikkerhet (ferdig)
│   ├── auth/                 # Magic links, CSRF
│   ├── security/             # Validering, rate limiting, webhook
│   └── monitoring/           # Audit logging
└── models/                   # ✅ Pydantic modeller (ferdig)
    └── events/               # Event-typer (SakEvent, EventType)
```

> **Merk:** `functions/adapters.py` inneholder allerede `ServiceContext` for lazy-loading av services, samt request/response adapters.

### `host.json`

Eksisterende konfigurasjon i `backend/host.json`:

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      }
    },
    "logLevel": {
      "default": "Information",
      "Host.Results": "Error",
      "Function": "Information",
      "Host.Aggregator": "Trace"
    }
  },
  "extensions": {
    "http": {
      "routePrefix": "api",
      "maxOutstandingRequests": 200,
      "maxConcurrentRequests": 100,
      "dynamicThrottlesEnabled": true
    }
  },
  "functionTimeout": "00:05:00"
}
```

### `function_app.py` (faktisk implementasjon)

Nåværende implementasjon i `backend/function_app.py` bruker `ServiceContext` fra `functions/adapters.py`:

```python
import azure.functions as func
from functions.adapters import (
    ServiceContext,
    adapt_request,
    create_response,
    create_error_response,
    validate_required_fields
)
from models.events import parse_event

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    """Health check endpoint."""
    return create_response({
        "status": "healthy",
        "service": "KOE Automation System",
        "version": "1.0.0"
    })

@app.route(route="cases/{sakId}/state", methods=["GET"])
def get_case_state(req: func.HttpRequest) -> func.HttpResponse:
    """Hent beregnet state for en sak (Event Sourcing)."""
    sak_id = req.route_params.get('sakId')
    with ServiceContext() as ctx:
        events_data, version = ctx.event_repository.get_events(sak_id)
        if not events_data:
            return create_error_response(f"Sak ikke funnet: {sak_id}", 404)
        events = [parse_event(e) for e in events_data]
        state = ctx.timeline_service.compute_state(events)
        return create_response({"version": version, "state": state.model_dump(mode='json')})

@app.route(route="cases/{sakId}/timeline", methods=["GET"])
def get_case_timeline(req: func.HttpRequest) -> func.HttpResponse:
    """Hent full event-tidslinje for UI-visning."""
    sak_id = req.route_params.get('sakId')
    with ServiceContext() as ctx:
        events_data, version = ctx.event_repository.get_events(sak_id)
        if not events_data:
            return create_error_response(f"Sak ikke funnet: {sak_id}", 404)
        events = [parse_event(e) for e in events_data]
        timeline = ctx.timeline_service.get_timeline(events)
        return create_response({"version": version, "events": timeline})

@app.route(route="webhook/catenda/{secret_path}", methods=["POST"])
def webhook_catenda(req: func.HttpRequest) -> func.HttpResponse:
    """Catenda webhook endpoint med secret path validering."""
    # ... se function_app.py for full implementasjon
```

> **⚠️ Manglende POST-endpoints:** `function_app.py` mangler fortsatt `POST /api/events` og `POST /api/events/batch` for event submission. Disse finnes i Flask-versjonen (`routes/event_routes.py`) og må porteres før full produksjonsdeploy.

### Deploy

```bash
# Med Azure Functions Core Tools
func azure functionapp publish koe-backend

# Med Azure CLI
az functionapp deployment source config-zip \
  --resource-group koe-rg \
  --name koe-backend \
  --src backend.zip
```

---

## Database: PostgreSQL

### Utviklingsmiljø: Supabase

I utviklingsmiljøet brukes **Supabase** (managed PostgreSQL):
- Rask oppstart og gratis tier for prototyping
- Native JSONB for event payloads
- Row Level Security (RLS)
- **Begrensning:** Mangler client-side transaksjoner via PostgREST

> ⚠️ **Supabase er kun for utvikling.** For produksjon anbefales Azure PostgreSQL.

### Produksjonsalternativer

Se [DATABASE_ARCHITECTURE.md](../backend/docs/DATABASE_ARCHITECTURE.md) for fullstendig analyse.

| Database | Anbefaling | Begrunnelse |
|----------|------------|-------------|
| **Azure PostgreSQL** | ✅ Anbefalt | Enklest migrering fra Supabase, full ACID |
| Azure SQL | Alternativ | God transaksjonsstøtte, krever skjema-tilpasning |
| Dataverse | Kun hvis Power Platform | Batch-transaksjoner, høy migreringskompleksitet |

### Tabellstruktur (CloudEvents v1.0)

Systemet bruker Event Sourcing med tre event-tabeller:

```sql
-- Standard KOE-saker
CREATE TABLE koe_events (
    id SERIAL PRIMARY KEY,
    -- CloudEvents Required Attributes
    specversion TEXT NOT NULL DEFAULT '1.0',
    event_id UUID NOT NULL UNIQUE,
    source TEXT NOT NULL,           -- /projects/{prosjekt_id}/cases/{sak_id}
    type TEXT NOT NULL,             -- no.oslo.koe.{event_type}
    -- CloudEvents Optional Attributes
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subject TEXT NOT NULL,          -- sak_id
    datacontenttype TEXT DEFAULT 'application/json',
    -- Extension Attributes
    actor TEXT NOT NULL,
    actorrole TEXT NOT NULL CHECK (actorrole IN ('TE', 'BH')),
    comment TEXT,
    referstoid UUID,
    -- Data Payload
    data JSONB NOT NULL,
    -- Internal
    sak_id TEXT NOT NULL,
    versjon INTEGER NOT NULL,
    CONSTRAINT unique_koe_sak_version UNIQUE (sak_id, versjon)
);

-- Tilsvarende for forsering_events og endringsordre_events
```

**Metadata-tabell:**

```sql
CREATE TABLE sak_metadata (
    sak_id TEXT PRIMARY KEY,
    prosjekt_id TEXT,
    catenda_topic_id TEXT,
    sakstype TEXT DEFAULT 'standard',  -- standard, forsering, endringsordre
    cached_title TEXT,
    cached_status TEXT,
    last_event_at TIMESTAMPTZ
);
```

### State-projeksjon

SakState beregnes alltid fra events via TimelineService:

```python
# Aldri direkte state-oppdatering - alltid via events
events, version = event_repo.get_events(sak_id)
state = timeline_service.compute_state(events)
```

### Repository Pattern

Backend bruker factory-funksjoner for å bytte database:

```python
# Miljøvariabel bestemmer backend
EVENT_STORE_BACKEND=supabase  # dev
EVENT_STORE_BACKEND=azure_postgres  # prod (fremtidig)

# Factory-funksjon
from repositories import create_event_repository
event_repo = create_event_repository()
```

### Row-Level Security

```
Tilgangskontroll:
├── Oslobygg-ansatte: Full tilgang til alle saker
├── Entreprenør (TE): Kun egne saker
└── Byggherre (BH): Kun tildelte saker
```

---

## Event-format: CloudEvents

Systemet bruker **CloudEvents v1.0** som event-format. Dette er en CNCF-standard som gir:

- **Standardisering** - Felles format som er selvdokumenterende
- **Interoperabilitet** - SDK-er for Python, JavaScript, Go, Java, .NET
- **Azure-kompatibilitet** - Native støtte i Azure Event Grid

### Event-struktur

```json
{
  "specversion": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "source": "/projects/P-2025-001/cases/KOE-2025-042",
  "type": "no.oslo.koe.grunnlag_opprettet",
  "time": "2025-12-20T10:30:00Z",
  "subject": "KOE-2025-042",
  "datacontenttype": "application/json",
  "actor": "ola.nordmann@firma.no",
  "actorrole": "TE",
  "data": {
    "tittel": "Forsinket tegningsunderlag",
    "hovedkategori": "SVIKT",
    "underkategori": "MEDVIRK"
  }
}
```

### API-støtte

- `Accept: application/cloudevents+json` på `/api/cases/{sak_id}/timeline`
- Schema-endepunkter: `/api/cloudevents/schemas`

Se [CLOUDEVENTS_ADOPTION.md](CLOUDEVENTS_ADOPTION.md) for fullstendig dokumentasjon.

---

## Azure Event Grid (fremtidig)

> **Status:** Ikke implementert. Avhenger av om virksomheten har Azure Event Grid tilgjengelig.

### Hvorfor Event Grid?

Event Grid kan gi betydelig verdi for robusthet og skalerbarhet:

| Fordel | Beskrivelse |
|--------|-------------|
| **Retry** | Automatisk retry ved feil (eksponentiell backoff) |
| **Ingen datatap** | Event lagres i database FØR Catenda-kall |
| **Fan-out** | Samme event til Catenda + Power BI + varsling |
| **Dead-letter** | Events som feiler permanent fanges opp |

### Arkitektur med Event Grid

```
Frontend ──► Backend ──► PostgreSQL ──► ✅ Lagret (garantert)
                              │
                              └──► Event Grid ──► Catenda (retry)
                                       │
                                       ├──► Power BI (fan-out)
                                       └──► Varsling (fan-out)
```

### Implementering (når aktuelt)

CloudEvents-formatet er allerede implementert, så Event Grid-integrasjon krever kun:

1. Konfigurere Azure Event Grid topic
2. Implementere publisering via `to_cloudevent()`
3. Sette opp subscriptions for Azure Functions
4. Implementere dead-letter håndtering

Se [CLOUDEVENTS_ADOPTION.md](CLOUDEVENTS_ADOPTION.md) fase 5 for detaljer.

---

## Sikkerhet

### 5 sikkerhetslag

1. **Nettverk (Azure Front Door)**
   - DDoS Protection
   - WAF (Web Application Firewall)
   - Rate limiting
   - Geo-filtering (valgfritt)

2. **Autentisering**
   - Magic Links (eksterne brukere)
   - Entra ID SSO (interne brukere)
   - MFA (multi-faktor)

3. **Autorisasjon**
   - CSRF-token validering
   - Rolle-basert tilgangskontroll
   - Project-scope validering

4. **Data**
   - PostgreSQL Row-Level Security
   - Managed Identity (ingen hardkodede credentials)
   - Kryptering i hvile og transit

5. **Overvåkning**
   - Application Insights
   - Azure Monitor Alerts
   - Audit logging

### Key Vault

Alle secrets lagres i Azure Key Vault:

```bash
# Opprett Key Vault
az keyvault create --name koe-keyvault --resource-group koe-rg

# Legg til secrets
az keyvault secret set --vault-name koe-keyvault \
  --name CATENDA-CLIENT-SECRET --value "..."
az keyvault secret set --vault-name koe-keyvault \
  --name CSRF-SECRET --value "..."
az keyvault secret set --vault-name koe-keyvault \
  --name WEBHOOK-SECRET-PATH --value "..."
```

### Managed Identity

Function App bruker Managed Identity for å hente secrets:

```python
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

credential = DefaultAzureCredential()
client = SecretClient(vault_url="https://koe-keyvault.vault.azure.net/", credential=credential)

catenda_secret = client.get_secret("CATENDA-CLIENT-SECRET").value
```

---

## Autentisering: IDA og Entra ID

### Hva er IDA?

**IDA** er Oslo kommunes sentraliserte tjeneste for identitets- og tilgangsstyring. IDA wrapper Microsoft Entra ID (tidligere Azure AD) og gir:

- Standardisert integrasjonsprosess for kommunale systemer
- Sentralisert forvaltning av tilganger
- Støtte fra IDA-forvaltningsteamet

> **Viktig:** Vi implementerer ikke Entra ID direkte. Vi bestiller integrasjon via IDA, og IDA-teamet hjelper med konfigurasjon.

### Bestillingsprosess

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Bestilling  │───▶│  Kartlegging │───▶│  Løsnings-   │───▶│  Implement-  │
│  via Kompass │    │  (møte)      │    │  design      │    │  ering       │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

**Bestilling sendes via Kompass** med skjema "Bestille tilgang til applikasjon for virksomheter".

#### Eksempel bestillingstekst

```markdown
## Systemet
Unified Timeline / KOE-system for Oslobygg KF

## Behov for tilgangsstyring
1. **Autentisering**: Ansatte i Oslobygg skal logge inn med Entra ID
2. **Autorisasjon**: Godkjenningsflyt basert på beløpsgrenser (se vedlegg)
3. **Rolle-identifikasjon**: Må kunne identifisere roller:
   - PL (Prosjektleder)
   - SL (Seksjonsleder)
   - AL (Avdelingsleder)
   - DU (Direktør utbygging)
   - AD (Administrerende direktør)
4. **Leder-hierarki**: Trenger tilgang til Microsoft Graph API
   for å hente brukerens leder (/me/manager)

## Teknisk
- Backend: Flask/Python på Azure App Service
- Frontend: React SPA på Azure Static Web Apps
- Støtter OIDC/OAuth2 og JWT-validering

## Ønsket tidsramme
Q2 2026
```

### Teknisk arkitektur

```
┌─────────┐    ┌─────────────┐    ┌─────────────────┐    ┌─────────────┐
│ Bruker  │───▶│  IDA/       │───▶│  Flask-app      │───▶│ Graph API   │
│         │    │  Entra ID   │    │  (validerer JWT)│    │ (manager)   │
└─────────┘    └─────────────┘    └─────────────────┘    └─────────────┘
                     │                     │
                     ▼                     ▼
              ┌─────────────────────────────────────┐
              │   JWT Token inneholder:             │
              │   - oid (bruker-ID)                 │
              │   - preferred_username (e-post)    │
              │   - name                            │
              │   - groups[] (rollegrupper)         │
              └─────────────────────────────────────┘
```

### Backend-støtte

Flask-appen har innebygd støtte for Entra ID-autentisering som kan aktiveres:

```python
# backend/core/config.py - Entra ID konfigurasjon
entra_enabled: bool = False          # Sett True når IDA er klar
entra_tenant_id: str = ""            # Fra IDA
entra_client_id: str = ""            # Fra IDA (audience)
entra_issuer: str = ""               # https://login.microsoftonline.com/{tenant}/v2.0
```

**Miljøvariabler for produksjon:**

```bash
ENTRA_ENABLED=true
ENTRA_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENTRA_CLIENT_ID=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
```

### Rolle-mapping

IDA konfigurerer Entra ID-grupper som mappes til applikasjonsroller:

| Entra ID-gruppe | Applikasjonsrolle | Godkjenningsgrense |
|-----------------|-------------------|-------------------|
| `KOE-Godkjenner-PL` | Prosjektleder | 0 – 500.000 kr |
| `KOE-Godkjenner-SL` | Seksjonsleder | 500.001 – 2.000.000 kr |
| `KOE-Godkjenner-AL` | Avdelingsleder | 2.000.001 – 5.000.000 kr |
| `KOE-Godkjenner-DU` | Direktør utbygging | 5.000.001 – 10.000.000 kr |
| `KOE-Godkjenner-AD` | Adm. direktør | Over 10.000.000 kr |

### Spørsmål til IDA-kartlegging

Under kartleggingsmøtet, avklar:

1. **Rolle-mapping**: Hvordan identifisere PL/SL/AL/DU/AD?
   - Entra ID-grupper?
   - Directory extension attributes?
   - Stillingstittel fra HR-system?

2. **Graph API-tilgang**: Trenger `/me/manager` endpoint
   - Krever `User.Read.All` eller `Directory.Read.All`
   - Må konfigureres i app registration

3. **Token-claims**: Hvilke claims får vi automatisk?
   - `groups`? `roles`? `manager`?

### Enhetlig autentisering

**Alle brukere** (både interne og eksterne) autentiseres via Entra ID/IDA:

```
┌──────────────────────────────────────────────────────────────┐
│                     Autentisering                            │
├──────────────────────────────────────────────────────────────┤
│  Alle brukere:                                               │
│  └── Entra ID via IDA (SSO med MFA)                         │
│                                                              │
│  Rollebestemmelse (TE vs BH):                               │
│  └── Basert på organisasjonstilhørighet eller attributt     │
│      - Oslobygg-ansatte → BH (Byggherre)                    │
│      - Eksterne (entreprenører) → TE (Totalentreprenør)     │
│                                                              │
│  HR-system er master for:                                    │
│  └── Stillingstittel (PL/SL/AL/DU/AD)                       │
│  └── Organisasjonshierarki (leder-relasjoner)               │
│  └── Synkroniseres til Entra ID via HR-integrasjon          │
└──────────────────────────────────────────────────────────────┘
```

### HR-system som master

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  HR-system  │───▶│  Entra ID   │───▶│  IDA        │───▶│  Flask-app  │
│  (master)   │    │  (synk)     │    │  (wrapper)  │    │  (validerer)│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  HR-data som synkroniseres:         │
│  - Stillingstittel                  │
│  - Avdeling/seksjon                 │
│  - Leder (manager)                  │
│  - Ansettelsesforhold               │
└─────────────────────────────────────┘
```

**Spørsmål til IDA-kartlegging (oppdatert):**

1. **Hvordan identifisere TE vs BH?**
   - Organisasjonstilhørighet i Entra ID?
   - Domene (f.eks. `@oslobygg.no` vs `@ekstern.no`)?
   - Spesifikk gruppe eller attributt?

2. **Hvordan hentes stillingstittel/rolle?**
   - HR-synkronisering til `jobTitle` claim?
   - Directory extension attribute?
   - Custom claim fra HR-system?

3. **Hvordan hentes leder-hierarki?**
   - Graph API `/me/manager` (synkronisert fra HR)?
   - Custom attributt i token?

### Testing uten IDA

For lokal utvikling og testing før IDA er konfigurert:

```bash
# .env - Deaktiver Entra ID
ENTRA_ENABLED=false

# Bruk mock-autentisering via Magic Links (fallback)
```

Se også: [plan-godkjenning-workflow.md](plan-godkjenning-workflow.md) for godkjenningsflyt-integrasjon.

---

## Miljøvariabler

### Azure Functions (Application Settings)

| Variabel | Kilde | Beskrivelse |
|----------|-------|-------------|
| `CATENDA_CLIENT_ID` | Key Vault | OAuth client ID |
| `CATENDA_CLIENT_SECRET` | Key Vault | OAuth client secret |
| `CATENDA_PROJECT_ID` | Config | Standard prosjekt-ID |
| `CSRF_SECRET` | Key Vault | CSRF token secret |
| `WEBHOOK_SECRET_PATH` | Key Vault | Webhook URL secret |
| `DATAVERSE_CONNECTION` | Key Vault | Dataverse connection string |
| `ALLOWED_ORIGINS` | Config | CORS-tillatte origins |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Azure | App Insights tilkobling |

### Konfigurer via Azure CLI

```bash
# Sett app settings
az functionapp config appsettings set \
  --name koe-backend \
  --resource-group koe-rg \
  --settings \
    CATENDA_CLIENT_ID="@Microsoft.KeyVault(VaultName=koe-keyvault;SecretName=CATENDA-CLIENT-ID)" \
    CATENDA_CLIENT_SECRET="@Microsoft.KeyVault(VaultName=koe-keyvault;SecretName=CATENDA-CLIENT-SECRET)" \
    ALLOWED_ORIGINS="https://koe-frontend.azurestaticapps.net"
```

---

## CI/CD Pipeline

### GitHub Actions (eksempel)

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  build-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_API_BASE_URL: ${{ secrets.API_BASE_URL }}

      - name: Deploy to Azure SWA
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_SWA_TOKEN }}
          action: "upload"
          app_location: "/"
          output_location: "dist"

  build-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt

      - name: Run tests
        run: |
          cd backend
          python -m pytest tests/ -v

      - name: Deploy to Azure Functions
        uses: Azure/functions-action@v1
        with:
          app-name: koe-backend
          package: backend
          publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
```

---

## Overvåkning

### Application Insights

Konfigurer i `host.json`:

```json
{
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true
      }
    },
    "logLevel": {
      "default": "Information",
      "Host.Results": "Error",
      "Function": "Information"
    }
  }
}
```

### Alerts

Sett opp alerts i Azure Monitor:

| Alert | Terskel | Handling |
|-------|---------|----------|
| Feilrate > 5% | 5 minutter | E-post til team |
| Responstid > 3s | 10 minutter | E-post til team |
| Webhook feil | Umiddelbart | Slack + E-post |
| Disk usage > 80% | - | Automatisk skalering |

### Dashboard

Lag Azure Dashboard med:
- Request rate
- Error rate
- Response time (P50, P95, P99)
- Active cases
- Webhook success rate

---

## Sjekkliste

### Før produksjon

- [ ] Azure ressurser opprettet (SWA, Functions, Key Vault, PostgreSQL)
- [ ] Secrets konfigurert i Key Vault
- [ ] Managed Identity aktivert
- [ ] CORS konfigurert riktig
- [ ] WAF regler konfigurert
- [ ] SSL/TLS sertifikater
- [ ] Custom domain konfigurert
- [ ] Application Insights tilkoblet
- [ ] Alerts konfigurert
- [ ] CI/CD pipeline testet
- [ ] Backup-strategi dokumentert
- [ ] **PostgreSQL event-tabeller opprettet** (`koe_events`, `forsering_events`, `endringsordre_events`)
- [ ] **PostgreSQL metadata-tabell opprettet** (`sak_metadata`)
- [ ] Row-Level Security konfigurert
- [ ] Catenda webhooks oppdatert til produksjons-URL
- [ ] Load testing gjennomført
- [ ] Security review gjennomført
- [x] **CloudEvents v1.0 format implementert**
- [x] **Event Sourcing GET-endpoints portert til Azure Functions** (`/state`, `/timeline`)
- [ ] **Event Sourcing POST-endpoints portert til Azure Functions** (`/events`, `/events/batch`)

### Etter deploy

- [ ] Smoke test: Health endpoint (`GET /api/health`)
- [ ] Smoke test: Magic link flow (`POST /api/verify-magic-link`)
- [ ] Smoke test: Hent sak (`GET /api/cases/{id}`)
- [ ] Smoke test: Hent state (`GET /api/cases/{id}/state`)
- [ ] Smoke test: Hent timeline (`GET /api/cases/{id}/timeline`)
- [ ] Smoke test: Lagre utkast (`PUT /api/cases/{id}/draft`)
- [ ] Smoke test: Webhook mottak (`POST /webhook/catenda/{secret}`)
- [ ] Verifiser logging i App Insights
- [ ] Verifiser event log i event store

**Event Sourcing POST-endpoints (krever portering fra Flask):**
- [ ] Smoke test: Submit event (`POST /api/events`)
- [ ] Smoke test: Submit batch (`POST /api/events/batch`)
- [ ] Smoke test: Optimistisk låsing (conflict handling)

---

## Vedlegg: SharePoint-vurdering

> **Konklusjon:** SharePoint anbefales ikke for dette systemet, men kan vurderes for svært begrenset pilot.

### Hvorfor SharePoint ikke passer

Se [TECHNOLOGY_COMPARISON.md](TECHNOLOGY_COMPARISON.md) for fullstendig analyse. Hovedutfordringene:

| Begrensning | Konsekvens |
|-------------|------------|
| **500 raders delegation limit** | Sakliste fungerer ikke med >500 saker |
| **5 000 elementers listeterskel** | Nås innen 1-2 år med ~10 000 events/år |
| **Ingen felt-nivå sikkerhet** | Kan ikke skille TE/BH-felter |
| **Ingen transaksjoner** | Risiko for inkonsistent data |

### Kan SharePoint brukes for begrenset pilot?

**Scenario:** 1-2 prosjekter i stedet for 50

| Faktor | Vurdering |
|--------|-----------|
| **Antall saker** | ~50-100 saker per prosjekt = innenfor 500-grensen |
| **Event-volum** | ~500-1500 events = under 5000-terskelen |
| **Felt-sikkerhet** | ❌ Fortsatt problematisk - TE/BH må se ulike felter |
| **Kompleksitet** | ❌ Subsidiær logikk, tre-spor modell støttes ikke |

**Konklusjon for pilot:**

| Aspekt | Egnet for SharePoint? |
|--------|----------------------|
| Enkel saksregistrering | ✅ Ja |
| Statussporing | ✅ Ja |
| Varslings-workflows | ✅ Ja (Power Automate) |
| Tre-spor modell | ❌ Nei |
| Subsidiær logikk | ❌ Nei |
| TE/BH felt-separasjon | ❌ Nei |
| Catenda-integrasjon | ⚠️ Krever Premium-lisens |

**Anbefaling:** Hvis en begrenset pilot vurderes:
1. Definer et sterkt forenklet scope (kun statussporing, ingen kompleks logikk)
2. Aksepter at felt-sikkerhet må håndteres manuelt (separate lister eller visninger)
3. Plan for migrering til fullverdig løsning etter pilot
4. Vurder om innsatsen er verdt det vs. å bruke eksisterende custom-løsning

Se [TECHNOLOGY_COMPARISON.md](TECHNOLOGY_COMPARISON.md) for detaljert sammenligning.

---

## Se også

- [AZURE_READINESS.md](AZURE_READINESS.md) – **Status og handlingsplan for Azure-deploy**
- [ARCHITECTURE_QUALITY.md](ARCHITECTURE_QUALITY.md) – Arkitekturkvalitet og forbedringer
- [DATABASE_ARCHITECTURE.md](../backend/docs/DATABASE_ARCHITECTURE.md) – Database-alternativer og transaksjoner
- [CLOUDEVENTS_ADOPTION.md](CLOUDEVENTS_ADOPTION.md) – CloudEvents-implementering og Azure Event Grid
- [TECHNOLOGY_COMPARISON.md](TECHNOLOGY_COMPARISON.md) – Custom-løsning vs. Power Platform/SharePoint
- [EXTERNAL_DEPLOYMENT.md](EXTERNAL_DEPLOYMENT.md) – Alternativ deploy (Vercel/Render/Supabase)
- [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) – Sikkerhetsarkitektur
- [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) – Frontend-arkitektur
- [GETTING_STARTED.md](GETTING_STARTED.md) – Lokal utvikling
- [backend/STRUCTURE.md](../backend/STRUCTURE.md) – Backend-mappestruktur
