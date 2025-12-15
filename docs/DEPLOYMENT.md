# Deployment Guide

**Sist oppdatert:** 2025-12-15

Veiledning for utrulling av Skjema Endringsmeldinger til produksjon.

---

## Innhold

- [Oversikt](#oversikt)
- [Arkitektur](#arkitektur)
- [Frontend: Azure Static Web Apps](#frontend-azure-static-web-apps)
- [Backend: Azure Functions](#backend-azure-functions)
- [Database: Dataverse](#database-dataverse)
- [Sikkerhet](#sikkerhet)
- [Miljøvariabler](#miljøvariabler)
- [CI/CD Pipeline](#cicd-pipeline)
- [Overvåkning](#overvåkning)
- [Sjekkliste](#sjekkliste)

---

## Oversikt

### Prototype vs. Produksjon

| Aspekt | Prototype | Produksjon |
|--------|-----------|------------|
| Frontend | Vite dev server | Azure Static Web Apps |
| Backend | Flask (Python) | Azure Functions (Python) |
| Event Store | JSON-filer (per sak) | Microsoft Dataverse |
| Arkitektur | Event Sourcing + CQRS | Event Sourcing + CQRS |
| Autentisering | Magic links | Magic links + Entra ID |
| Sikkerhet | Basis CSRF/CORS | WAF, DDoS, RLS |
| Hosting | Lokal/ngrok | Azure |

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
│  │  - Event Sourcing (immutabel hendelseslogg)                      │ │
│  │  - Gatekeeper (autorisasjon + rollebasert tilgang)               │ │
│  │  - Input-validering (UUID, felt-validering)                      │ │
│  │  - Magic Link-håndtering                                         │ │
│  │  - Webhook-mottak fra Catenda                                    │ │
│  │  - Optimistisk låsing (versjonskontroll)                         │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───────────────┬───────────────────────────────────┬───────────────────┘
                │                                   │
                │ Managed Identity                  │ HTTPS
                ▼                                   ▼
┌───────────────────────────────┐    ┌──────────────────────────────────┐
│      Dataverse (Event Store)  │    │           Catenda                │
│  ┌─────────────────────────┐  │    │  ┌────────────────────────────┐  │
│  │  - koe_events           │  │    │  │  - Webhook (inn)           │  │
│  │    (append-only log)    │  │    │  │  - Document API v2         │  │
│  │  - koe_sak_metadata     │  │    │  │  - BCF 3.0 API             │  │
│  │  - koe_magic_links      │  │    │  │  - Project Members         │  │
│  └─────────────────────────┘  │    │  └────────────────────────────┘  │
│  Row-Level Security           │    │  Autoritativ dokument-kilde      │
│  Encryption at rest           │    └──────────────────────────────────┘
└───────────────────────────────┘
                │
                │ Native Connector
                ▼
┌───────────────────────────────┐
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

## Database: Dataverse (Event Store)

### Event Sourcing med Dataverse

Systemet bruker Event Sourcing der alle endringer lagres som uforanderlige hendelser:

| Tabell | Beskrivelse | Primærnøkkel |
|--------|-------------|--------------|
| `koe_events` | Event store (append-only) | `event_id` |
| `koe_sak_metadata` | Metadata-cache for sakliste | `sak_id` |
| `koe_magic_link` | Magic link tokens | `token_id` |

### Event-struktur i Dataverse

```python
# Hver event lagres med følgende struktur:
{
    "event_id": "uuid",
    "sak_id": "SAK-001",
    "event_type": "GRUNNLAG_OPPRETTET",  # eller andre EventType
    "tidsstempel": "2025-12-06T10:00:00Z",
    "aktor": "ola.nordmann@firma.no",
    "aktor_rolle": "TE",  # eller "BH"
    "data": { ... },  # Event-spesifikk payload (JSON)
    "kommentar": "Valgfri kommentar",
    "referrer_til_event_id": null  # Referanse til tidligere event
}
```

### Produksjons Event Repository

Det finnes flere alternativer for produksjons event store:

#### Alternativ 1: Supabase (PostgreSQL)

Allerede implementert i `repositories/supabase_event_repository.py`:

```python
# Supabase bruker PostgreSQL med:
# - Native JSONB for event payloads
# - Row Level Security for TE/BH separasjon
# - Optimistisk låsing via versjon-constraint

# SQL-skjema (se supabase_event_repository.py for full migrasjon):
CREATE TABLE koe_events (
    id SERIAL PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    sak_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    tidsstempel TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aktor TEXT NOT NULL,
    aktor_rolle TEXT NOT NULL CHECK (aktor_rolle IN ('TE', 'BH')),
    data JSONB NOT NULL,
    versjon INTEGER NOT NULL,
    CONSTRAINT unique_sak_version UNIQUE (sak_id, versjon)
);
```

#### Alternativ 2: Dataverse (planlagt)

```python
# repositories/dataverse_event_repository.py (ikke implementert)
# Følger samme EventRepository interface som Supabase-versjonen
class DataverseEventRepository(EventRepository):
    def append(self, event: SakEvent, expected_version: int) -> int:
        """Legg til event med optimistisk låsing."""
        # ... Dataverse-spesifikk implementasjon
```

### State-projeksjon

SakState beregnes alltid fra events via TimelineService:

```python
# Aldri direkte state-oppdatering - alltid via events
events, version = event_repo.get_events(sak_id)
state = timeline_service.compute_state(events)
```

### Row-Level Security

Dataverse støtter RLS for å begrense tilgang:

```
koe_sak
├── Oslobygg-ansatte: Full tilgang til alle saker
├── Entreprenør: Kun egne saker (basert på e-post/firma)
└── Byggherre: Kun saker de er tildelt
```

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
   - Dataverse Row-Level Security
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

- [ ] Azure ressurser opprettet (SWA, Functions, Key Vault, Dataverse)
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
- [ ] **Dataverse event store tabell (`koe_events`) opprettet**
- [ ] **Dataverse metadata tabell (`koe_sak_metadata`) opprettet**
- [ ] Row-Level Security konfigurert
- [ ] Catenda webhooks oppdatert til produksjons-URL
- [ ] Load testing gjennomført
- [ ] Security review gjennomført
- [x] **Event Sourcing GET-endpoints portert til Azure Functions** (`/state`, `/timeline`)
- [ ] **Event Sourcing POST-endpoints portert til Azure Functions** (`/events`, `/events/batch`)

### Etter deploy

- [ ] Smoke test: Health endpoint (`GET /api/health`)
- [ ] Smoke test: Magic link flow (`POST /api/verify-magic-link`)
- [ ] Smoke test: Hent sak (`GET /api/cases/{id}`)
- [ ] Smoke test: Hent state (`GET /api/cases/{id}/state`) ✅
- [ ] Smoke test: Hent timeline (`GET /api/cases/{id}/timeline`) ✅
- [ ] Smoke test: Lagre utkast (`PUT /api/cases/{id}/draft`)
- [ ] Smoke test: Webhook mottak (`POST /webhook/catenda/{secret}`)
- [ ] Verifiser logging i App Insights
- [ ] Verifiser event log i event store

**Event Sourcing POST-endpoints (krever portering fra Flask):**
- [ ] Smoke test: Submit event (`POST /api/events`) ⚠️
- [ ] Smoke test: Submit batch (`POST /api/events/batch`) ⚠️
- [ ] Smoke test: Optimistisk låsing (conflict handling) ⚠️

---

## Se også

- [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) – Sikkerhetsarkitektur (prototype vs. produksjon)
- [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) – Frontend-arkitektur
- [GETTING_STARTED.md](GETTING_STARTED.md) – Lokal utvikling
- [backend/STRUCTURE.md](../backend/STRUCTURE.md) – Backend-mappestruktur
