# Azure Produksjonsklarhet

**Sist oppdatert:** 2026-02-01

Status og handlingsplan for Azure-deploy av Unified Timeline.

---

## Innhold

- [Sammendrag](#sammendrag)
- [Backend: Azure Functions](#backend-azure-functions)
- [Frontend: Azure Static Web Apps](#frontend-azure-static-web-apps)
- [Kritiske blokkere](#kritiske-blokkere)
- [Handlingsplan](#handlingsplan)
- [Estimater](#estimater)

---

## Sammendrag

### Beredskapsgrad: ⚠️ ~50%

| Kategori | Status | Dekning |
|----------|--------|---------|
| Azure Functions entry point | ✅ Ferdig | 100% |
| Azure Functions konfigurasjon | ✅ Ferdig | 100% |
| Azure Functions endpoints | ⚠️ Delvis | **12/68 (18%)** |
| Frontend build | ✅ Ferdig | 100% |
| Frontend Azure-konfig | ✅ Ferdig | 100% |
| CI/CD pipelines | ✅ Ferdig | 100% |
| Azure SDK dependencies | ✅ Ferdig | 100% |

### Hva fungerer i dag

- ✅ Flask-backend kjører lokalt med alle 68 endpoints
- ✅ Frontend bygger og kjører lokalt
- ✅ Supabase-integrasjon fungerer
- ✅ CloudEvents v1.0 implementert
- ✅ 12 endpoints portert til Azure Functions (inkl. kritiske event submission)
- ✅ GitHub Actions workflows for CI/CD
- ✅ `staticwebapp.config.json` for frontend
- ✅ Azure SDK-pakker i `requirements.txt`

### Hva mangler for Azure-deploy

**Med App Service (anbefalt):**
- ✅ Ingenting - Flask-appen er klar, bare deploy `app.py`
- ❌ Azure-ressurser må opprettes i Azure Portal

**Med Azure Functions (alternativ):**
- ❌ 56 Flask-routes ikke portert
- ⚠️ Background processing (synkron fallback)

### Anbefaling

**Bruk Azure App Service (B1, ~140 kr/mnd)** - enklest, ingen kodeendringer, ingen cold start.
Azure Functions er overkill for vår enterprise B2B-applikasjon med forutsigbar trafikk.

---

## Backend: Azure Functions

### Implementerte filer

| Fil | Status | Beskrivelse |
|-----|--------|-------------|
| `backend/function_app.py` | ✅ | Azure Functions entry point (374 linjer) |
| `backend/functions/adapters.py` | ✅ | Request/response adapters, ServiceContext |
| `backend/host.json` | ✅ | Azure Functions konfigurasjon |
| `backend/local.settings.json.example` | ✅ | Template for lokale innstillinger |

### Implementerte endpoints (12/68)

| Route | Metode | Beskrivelse |
|-------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/csrf-token` | GET | CSRF token generering |
| `/api/verify-magic-link` | POST | Magic link validering |
| `/api/cases` | GET | Liste saker (med sakstype-filter) |
| `/api/cases/{sakId}` | GET | Hent enkelt sak |
| `/api/cases/{sakId}/state` | GET | Event Sourcing state |
| `/api/cases/{sakId}/timeline` | GET | Event tidslinje |
| `/api/cases/{sakId}/draft` | PUT | Lagre utkast |
| `/api/cases/{sakId}/pdf` | POST | Last opp PDF til Catenda |
| `/api/webhook/catenda/{secret}` | POST | Catenda webhook mottak |
| `/api/events` | POST | ✅ Submit enkelt event |
| `/api/events/batch` | POST | ✅ Atomisk batch submission (bruker SakCreationService) |

### Manglende endpoints (56 stk)

#### Forsering §33.8 (15 endpoints)

```
❌ POST   /api/forsering/opprett
❌ GET    /api/forsering/<id>
❌ GET    /api/forsering/<id>/state
❌ GET    /api/forsering/<id>/timeline
❌ GET    /api/forsering/<id>/relaterte
❌ GET    /api/forsering/<id>/kontekst
❌ POST   /api/forsering/<id>/events
❌ PUT    /api/forsering/<id>/draft
... (7 flere)
```

#### Endringsordre §31.3 (8 endpoints)

```
❌ POST   /api/endringsordre/opprett
❌ GET    /api/endringsordre/<id>
❌ GET    /api/endringsordre/<id>/state
❌ GET    /api/endringsordre/<id>/timeline
❌ GET    /api/endringsordre/<id>/relaterte
... (3 flere)
```

#### Fravik (14 endpoints)

```
❌ POST   /api/fravik/opprett
❌ GET    /api/fravik/<id>/state
❌ GET    /api/fravik/<id>/timeline
... (11 flere)
```

#### Analytics (8 endpoints)

```
❌ GET    /api/analytics/summary
❌ GET    /api/analytics/by-category
❌ GET    /api/analytics/by-status
❌ GET    /api/analytics/timeline
... (4 flere)
```

#### CloudEvents Schema (4 endpoints)

```
❌ GET    /api/cloudevents/schemas
❌ GET    /api/cloudevents/schemas/<type>
❌ GET    /api/cloudevents/envelope-schema
❌ GET    /api/cloudevents/all-schemas
```

#### Andre (7+ endpoints)

```
❌ GET    /api/sync/mappings
❌ POST   /api/letter/generate
... (flere sync/utility endpoints)
```

---

## Frontend: Azure Static Web Apps

### Implementert

| Komponent | Status | Fil |
|-----------|--------|-----|
| Vite build config | ✅ | `vite.config.ts` |
| Code splitting | ✅ | vendor-react, vendor-pdf chunks |
| Environment vars | ✅ | `.env.example` |
| Production build | ✅ | `npm run build` → `dist/` |

### Mangler

| Komponent | Status | Beskrivelse |
|-----------|--------|-------------|
| `staticwebapp.config.json` | ❌ | **Kritisk** - routing, SPA fallback |
| GitHub Actions workflow | ❌ | CI/CD for Azure SWA |
| API proxy config | ❌ | `/api/*` routing til Functions |

#### Nødvendig `staticwebapp.config.json`

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.ico", "/*.png"]
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
    "Referrer-Policy": "strict-origin-when-cross-origin"
  },
  "mimeTypes": {
    ".woff2": "font/woff2",
    ".woff": "font/woff"
  }
}
```

---

## Kritiske blokkere

### 1. ✅ ~~Manglende Azure SDK i `requirements.txt`~~ LØST

Azure SDK er nå lagt til i `backend/requirements.txt`:
- `azure-functions>=1.17.0`
- `azure-identity>=1.15.0`
- `azure-keyvault-secrets>=4.7.0`

### 2. ✅ ~~Manglende `staticwebapp.config.json`~~ LØST

`staticwebapp.config.json` er opprettet i repository root med:
- SPA fallback routing
- Security headers
- Cache-kontroll for assets

### 3. ✅ ~~Threading i background tasks~~ LØST

All threading-kode er fjernet:
- `catenda_webhook_service.py` - refaktorert til synkron operasjon
- `catenda_service.py` - `async_mode`-parameter og threading fjernet

### 4. ✅ ~~Event submission endpoints mangler~~ LØST

`POST /api/events` og `POST /api/events/batch` er portert til `function_app.py`.
Batch-endepunktet bruker `SakCreationService` for atomisk saksopprettelse.

---

## Handlingsplan

### Fase 1: Minimalt deploybart (MVP) ✅ FULLFØRT

**Mål:** Kunne deploye og kjøre basis-funksjonalitet i Azure.

| # | Oppgave | Prioritet | Status |
|---|---------|-----------|--------|
| 1.1 | Legg til Azure SDK i requirements.txt | 🔴 Kritisk | ✅ Ferdig |
| 1.2 | Opprett staticwebapp.config.json | 🔴 Kritisk | ✅ Ferdig |
| 1.3 | Port POST /api/events endpoint | 🔴 Kritisk | ✅ Ferdig |
| 1.4 | Port POST /api/events/batch endpoint | 🔴 Kritisk | ✅ Ferdig |
| 1.5 | Fjern/deaktiver threading i webhook_service | 🟡 Høy | ✅ Ferdig (synkron) |
| 1.6 | Opprett GitHub Actions workflows | 🟡 Høy | ✅ Ferdig |

**Neste:** Test lokalt med `func start`, deretter deploy til Azure.

### Fase 2: Komplett KOE-funksjonalitet

**Mål:** Alle standard KOE-endpoints tilgjengelig.

| # | Oppgave | Prioritet | Estimat |
|---|---------|-----------|---------|
| 2.1 | Port analytics endpoints (8 stk) | 🟡 Høy | 3 timer |
| 2.2 | Port CloudEvents schema endpoints (4 stk) | 🟢 Medium | 1 time |
| 2.3 | Port sync/utility endpoints | 🟢 Medium | 2 timer |
| 2.4 | Opprett GitHub Actions workflow | 🟡 Høy | 2 timer |

**Total Fase 2:** ~8 timer

### Fase 3: Forsering og Endringsordre

**Mål:** Full funksjonalitet for alle sakstyper.

| # | Oppgave | Prioritet | Estimat |
|---|---------|-----------|---------|
| 3.1 | Port forsering endpoints (15 stk) | 🟢 Medium | 6 timer |
| 3.2 | Port endringsordre endpoints (8 stk) | 🟢 Medium | 4 timer |
| 3.3 | Port fravik endpoints (14 stk) | 🟢 Medium | 5 timer |

**Total Fase 3:** ~15 timer

### Fase 4: Robust produksjon

**Mål:** Produksjonsklar med proper async handling.

| # | Oppgave | Prioritet | Estimat |
|---|---------|-----------|---------|
| 4.1 | Implementer Azure Service Bus for background tasks | 🟢 Medium | 8 timer |
| 4.2 | Implementer Azure Key Vault for secrets | 🟢 Medium | 4 timer |
| 4.3 | Sett opp Application Insights | 🟢 Medium | 2 timer |
| 4.4 | Load testing | 🟢 Medium | 4 timer |
| 4.5 | Security review | 🟢 Medium | 4 timer |

**Total Fase 4:** ~22 timer

---

## Estimater

### Totalt arbeid

| Fase | Beskrivelse | Estimat |
|------|-------------|---------|
| Fase 1 | Minimalt deploybart | ~6 timer |
| Fase 2 | Komplett KOE | ~8 timer |
| Fase 3 | Forsering + EO | ~15 timer |
| Fase 4 | Robust produksjon | ~22 timer |
| **Total** | | **~51 timer** |

---

## Valg av Azure Backend-hosting

### Anbefaling: **Azure App Service (Linux B1)**

For denne typen enterprise B2B-applikasjon er App Service det beste valget.

#### Prissammenligning

| Plan | Cold start | Pris/mnd | Passer for |
|------|------------|----------|------------|
| **Functions Consumption** | ⚠️ 5-10 sek | Gratis* | Kun prototype |
| **Functions Flex** | ✅ Ingen | ~200-400 kr | Overkill for oss |
| **App Service Free (F1)** | ⚠️ Sovner | Gratis | Prototype |
| **App Service Basic (B1)** | ✅ Ingen | **~140 kr** | ✅ **Anbefalt** |

\* Gratis opp til 1M requests/mnd

#### Hvorfor App Service for oss

**Vår bruksprofil:**
- ~50-500 prosjektdeltakere (enterprise B2B)
- Trafikk i kontortid (08-16)
- Maks 10-20 samtidige brukere
- Noen hundre til få tusen events/dag

**Serverless skalering gir mening når:**
- Uforutsigbar burst-trafikk (Black Friday, virale kampanjer)
- Mange uavhengige tenants (SaaS med 10 000+ kunder)
- Sporadisk kjøring (nattlige batch-jobber)
- Event-drevet med millioner av meldinger (IoT)

**Vi har ingen av disse.** En App Service B1 håndterer vår trafikk med god margin.

#### Fordeler med App Service

| Aspekt | App Service | Functions |
|--------|-------------|-----------|
| **Deploy** | `git push` → ferdig | Må porte 56 endpoints |
| **Kodeendringer** | Ingen | Ny `function_app.py` |
| **Cold start** | Ingen (B1+) | Ja (Consumption) |
| **Pris** | ~140 kr/mnd | ~200-400 kr (Flex) |
| **Kompleksitet** | Lav | Høyere |

### Dual-mode arkitektur (beholdes)

Vi har fortsatt to entry points for fleksibilitet:

```
┌─────────────────────────────────────────────────────────────┐
│                    Felles kjernelogikk                      │
│     services/, repositories/, models/, core/container.py   │
└─────────────────────────────────────────────────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────┐      ┌─────────────────────────┐
│   app.py (Flask)    │      │  function_app.py        │
│                     │      │  (Native Azure Funcs)   │
│ ✅ App Service      │      │ ⚠️ Kun hvis serverless  │
│ ✅ Render           │      │    trengs senere        │
│ ✅ Lokal utvikling  │      │                         │
└─────────────────────┘      └─────────────────────────┘
```

### Migrasjonsvei

```
Fase 1: Prototype (nå)
├── Vercel (frontend)
└── Render (backend/Flask)

Fase 2: Azure produksjon (anbefalt)
├── Azure Static Web Apps (frontend)
└── Azure App Service B1 (backend/Flask)  ← Ingen kodeendringer!

Fase 3: Kun hvis behov oppstår
└── Azure Functions (hvis serverless skalering trengs)
```

---

## Filer som er endret/opprettet

### Nye filer (opprettet)

```
/staticwebapp.config.json                        # ✅ Azure SWA konfig
/.github/workflows/azure-static-web-apps.yml     # ✅ Frontend CI/CD
/.github/workflows/azure-functions.yml           # ✅ Backend CI/CD
```

### Oppdaterte filer

```
backend/requirements.txt               # ✅ Azure SDK pakker lagt til
backend/function_app.py                # ✅ Event submission endpoints portert
backend/services/catenda_webhook_service.py  # ✅ Synkron (ingen threading)
```

### Gjenstår å oppdatere

Ingen kritiske filer gjenstår.

---

## Neste steg

### Anbefalt: App Service (enklest)

1. **Opprett Azure-ressurser:**
   - Azure Static Web App (frontend)
   - Azure App Service (backend, Python 3.11, Linux, B1-plan)

2. **Konfigurer GitHub for App Service:**
   - I Azure Portal: App Service → Deployment Center → GitHub
   - Velg repo og branch → Azure oppretter workflow automatisk

3. **Sett miljøvariabler i App Service → Configuration:**
   - `CATENDA_CLIENT_ID`, `CATENDA_CLIENT_SECRET`, `CATENDA_PROJECT_ID`
   - `SUPABASE_URL`, `SUPABASE_KEY`
   - `WEBHOOK_SECRET_PATH`, `MAGIC_LINK_SECRET_KEY`

4. **Aktiver "Always On"** i App Service → Configuration → General settings

5. **Push til main** - GitHub Actions deployer automatisk

### Alternativ: Azure Functions (kun hvis serverless trengs)

1. Opprett Azure Function App (Python 3.11, Linux, Flex plan)
2. Konfigurer GitHub Secrets: `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`
3. Bruk eksisterende `.github/workflows/azure-functions.yml`
4. Merk: Kun 12/68 endpoints er portert - resten må portes først

---

## Se også

- [ARCHITECTURE_QUALITY.md](ARCHITECTURE_QUALITY.md) - Arkitekturkvalitet og forbedringer
- [DEPLOYMENT.md](DEPLOYMENT.md) - Hovedguide for deploy
- [EXTERNAL_DEPLOYMENT.md](EXTERNAL_DEPLOYMENT.md) - Alternativ deploy (Vercel/Render)
- [DATABASE_ARCHITECTURE.md](../backend/docs/DATABASE_ARCHITECTURE.md) - Database-valg
