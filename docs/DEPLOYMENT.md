# Deployment Guide

**Sist oppdatert:** 2025-12-01

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
| Database | CSV-filer | Microsoft Dataverse |
| Autentisering | Magic links | Magic links + Entra ID |
| Sikkerhet | Basis CSRF/CORS | WAF, DDoS, RLS |
| Hosting | Lokal/ngrok | Azure |

### Produksjonsmiljø

```
┌─────────────────────────────────────────────────────────────────┐
│                    Azure Front Door + WAF                       │
│           (DDoS Protection, Rate Limiting, Geo-filter)          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│  Azure Static Web     │       │   Azure Functions     │
│  Apps (Frontend)      │──────▶│   (Backend API)       │
│  - React 19           │       │   - Python 3.11       │
│  - TypeScript         │       │   - Pydantic          │
│  - Punkt design       │       │   - Catenda client    │
└───────────────────────┘       └───────────┬───────────┘
                                            │
                        ┌───────────────────┼───────────────────┐
                        │                   │                   │
                        ▼                   ▼                   ▼
              ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
              │   Dataverse     │ │     Catenda     │ │   Key Vault     │
              │   (Database)    │ │   (Prosjekt-    │ │   (Secrets)     │
              │                 │ │    hotell)      │ │                 │
              └─────────────────┘ └─────────────────┘ └─────────────────┘
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
# Generer statuskonstanter
npm run generate:constants

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
├── function_app.py           # Azure Functions entry point (må opprettes)
├── host.json                 # ✅ Host konfigurasjon (eksisterer)
├── local.settings.json       # Lokale innstillinger (må opprettes)
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
├── repositories/             # ✅ CSV (Dataverse må implementeres)
├── integrations/             # ✅ Catenda client (ferdig)
├── lib/                      # ✅ Sikkerhet (ferdig)
└── models/                   # ✅ Pydantic modeller (ferdig)
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

### `function_app.py` (eksempel)

Bruk eksisterende `ServiceContext` fra `functions/adapters.py`:

```python
import azure.functions as func
from functions.adapters import (
    ServiceContext,
    adapt_request,
    create_response,
    create_error_response
)

app = func.FunctionApp()

@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse('{"status": "healthy"}', mimetype="application/json")

@app.route(route="cases/{sakId}", methods=["GET"])
def get_case(req: func.HttpRequest) -> func.HttpResponse:
    sak_id = req.route_params.get('sakId')
    with ServiceContext() as ctx:
        data = ctx.repository.get_form_data(sak_id)
    return create_response(data)

@app.route(route="varsel-submit", methods=["POST"])
def submit_varsel(req: func.HttpRequest) -> func.HttpResponse:
    request_data = adapt_request(req)
    with ServiceContext() as ctx:
        result = ctx.varsel_service.submit_varsel(request_data['json'])
    return create_response(result)

@app.route(route="webhook/catenda/{secret_path}", methods=["POST"])
def webhook_catenda(req: func.HttpRequest) -> func.HttpResponse:
    secret_path = req.route_params.get('secret_path')
    with ServiceContext() as ctx:
        result = ctx.catenda_service.handle_webhook(
            secret_path,
            adapt_request(req)['json']
        )
    return create_response(result)
```

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

## Database: Dataverse

### Dataverse-tabeller

Erstatter CSV-filer med Dataverse-tabeller:

| Tabell | Beskrivelse | Primærnøkkel |
|--------|-------------|--------------|
| `koe_sak` | Hovedtabell for saker | `sak_id` |
| `koe_varsel` | Varsel-data | `varsel_id` |
| `koe_revisjon` | KOE-revisjoner | `revisjon_id` |
| `koe_bh_svar` | BH svar-revisjoner | `svar_id` |
| `koe_magic_link` | Magic link tokens | `token_id` |
| `koe_audit_log` | Audit log | `log_id` |

### Dataverse Repository

Ny repository-implementasjon:

```python
# repositories/dataverse_repository.py
from dataverse_api import DataverseClient
from repositories.base_repository import BaseRepository

class DataverseRepository(BaseRepository):
    def __init__(self, connection_string: str):
        self.client = DataverseClient(connection_string)

    def get_form_data(self, sak_id: str) -> dict:
        sak = self.client.get("koe_sak", sak_id)
        varsel = self.client.get_related("koe_varsel", sak_id)
        revisjoner = self.client.get_related("koe_revisjon", sak_id)
        svar = self.client.get_related("koe_bh_svar", sak_id)
        return self._combine_form_data(sak, varsel, revisjoner, svar)

    def save_form_data(self, sak_id: str, data: dict) -> None:
        # Transaksjonell oppdatering av alle tabeller
        with self.client.transaction():
            self.client.upsert("koe_sak", data['sak'])
            self.client.upsert("koe_varsel", data['varsel'])
            for rev in data['koe_revisjoner']:
                self.client.upsert("koe_revisjon", rev)
            for svar in data['bh_svar_revisjoner']:
                self.client.upsert("koe_bh_svar", svar)
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

      - name: Generate constants
        run: npm run generate:constants

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
- [ ] Dataverse-tabeller opprettet
- [ ] Row-Level Security konfigurert
- [ ] Catenda webhooks oppdatert til produksjons-URL
- [ ] Load testing gjennomført
- [ ] Security review gjennomført

### Etter deploy

- [ ] Smoke test: Health endpoint
- [ ] Smoke test: Magic link flow
- [ ] Smoke test: Submit varsel
- [ ] Smoke test: Submit KOE
- [ ] Smoke test: Webhook mottak
- [ ] Verifiser logging i App Insights
- [ ] Verifiser audit log i Dataverse

---

## Se også

- [HLD - Overordnet Design](HLD%20-%20Overordnet%20Design.md) – Detaljert arkitektur
- [API.md](API.md) – API-referanse
- [Handlingsplan_Sikkerhetstiltak.md](Handlingsplan_Sikkerhetstiltak.md) – Sikkerhetstiltak
- [GETTING_STARTED.md](GETTING_STARTED.md) – Lokal utvikling
