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

### Beredskapsgrad: ⚠️ ~35%

| Kategori | Status | Dekning |
|----------|--------|---------|
| Azure Functions entry point | ✅ Ferdig | 100% |
| Azure Functions konfigurasjon | ✅ Ferdig | 100% |
| Azure Functions endpoints | ⚠️ Delvis | **10/68 (15%)** |
| Frontend build | ✅ Ferdig | 100% |
| Frontend Azure-konfig | ❌ Mangler | 0% |
| CI/CD pipelines | ❌ Mangler | 0% |
| Azure SDK dependencies | ❌ Mangler | 0% |

### Hva fungerer i dag

- ✅ Flask-backend kjører lokalt med alle 68 endpoints
- ✅ Frontend bygger og kjører lokalt
- ✅ Supabase-integrasjon fungerer
- ✅ CloudEvents v1.0 implementert
- ✅ 10 basis-endpoints portert til Azure Functions

### Hva mangler for Azure-deploy

- ❌ 58 Flask-routes ikke portert til Azure Functions
- ❌ `staticwebapp.config.json` for frontend
- ❌ Azure SDK-pakker i `requirements.txt`
- ❌ Background processing (threading → Service Bus)
- ❌ CI/CD workflows

---

## Backend: Azure Functions

### Implementerte filer

| Fil | Status | Beskrivelse |
|-----|--------|-------------|
| `backend/function_app.py` | ✅ | Azure Functions entry point (374 linjer) |
| `backend/functions/adapters.py` | ✅ | Request/response adapters, ServiceContext |
| `backend/host.json` | ✅ | Azure Functions konfigurasjon |
| `backend/local.settings.json.example` | ✅ | Template for lokale innstillinger |

### Implementerte endpoints (10/68)

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

### Manglende endpoints (58 stk)

#### Kritisk: Event Submission (2 endpoints)

```
❌ POST /api/events           - Submit enkelt event
❌ POST /api/events/batch     - Atomisk batch submission
```

**Uten disse kan ikke systemet lagre nye events!**

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

### 1. ❌ Manglende Azure SDK i `requirements.txt`

**Problem:** `import azure.functions` vil feile i produksjon.

**Løsning:** Legg til i `backend/requirements.txt`:

```
azure-functions>=1.15.0
azure-identity>=1.15.0
azure-keyvault-secrets>=4.7.0
```

### 2. ❌ Manglende `staticwebapp.config.json`

**Problem:** SPA routing fungerer ikke, alle deep links gir 404.

**Løsning:** Opprett fil i repository root (se eksempel over).

### 3. ❌ Threading i background tasks

**Problem:** `webhook_service.py` og `catenda_service.py` bruker `threading.Thread()` for background processing. Dette fungerer **ikke** i Azure Functions - prosessen avsluttes etter HTTP-respons.

**Filer med problemet:**
- `backend/services/webhook_service.py:279`
- `backend/services/catenda_service.py:69`
- `backend/services/catenda_service.py:84`

**Løsninger:**
1. **Kortsiktig:** Fjern background processing, gjør synkront
2. **Langsiktig:** Azure Service Bus + separate Function triggers

### 4. ❌ Event submission endpoints mangler

**Problem:** Kan ikke lagre nye events via Azure Functions.

**Løsning:** Port `POST /api/events` og `POST /api/events/batch` fra `backend/routes/event_routes.py`.

---

## Handlingsplan

### Fase 1: Minimalt deploybart (MVP)

**Mål:** Kunne deploye og kjøre basis-funksjonalitet i Azure.

| # | Oppgave | Prioritet | Estimat |
|---|---------|-----------|---------|
| 1.1 | Legg til Azure SDK i requirements.txt | 🔴 Kritisk | 15 min |
| 1.2 | Opprett staticwebapp.config.json | 🔴 Kritisk | 30 min |
| 1.3 | Port POST /api/events endpoint | 🔴 Kritisk | 2 timer |
| 1.4 | Port POST /api/events/batch endpoint | 🔴 Kritisk | 1 time |
| 1.5 | Fjern/deaktiver threading i webhook_service | 🟡 Høy | 1 time |
| 1.6 | Test lokal Azure Functions (`func start`) | 🟡 Høy | 1 time |

**Total Fase 1:** ~6 timer

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

### Alternativ: Fortsett med Flask

Hvis Azure Functions-portering er for omfattende, kan Flask-backend deployes til:

- **Azure App Service** (Flask direkte)
- **Azure Container Apps** (Docker)
- **Render/Railway** (enklere, men ikke Azure)

Dette krever mindre portering men gir ikke serverless-fordeler.

---

## Filer som må endres

### Nye filer

```
/staticwebapp.config.json              # Azure SWA konfig
/.github/workflows/azure-deploy.yml    # CI/CD pipeline (valgfritt fase 2)
```

### Eksisterende filer

```
backend/requirements.txt               # Legg til azure-* pakker
backend/function_app.py                # Port flere endpoints
backend/services/webhook_service.py    # Fjern threading
backend/services/catenda_service.py    # Fjern threading
```

---

## Neste steg

1. **Beslutning:** Skal vi prioritere Azure Functions eller vurdere Azure App Service?
2. **Hvis Azure Functions:** Start med Fase 1 (MVP)
3. **Test lokalt:** `cd backend && func start` før deploy

---

## Se også

- [ARCHITECTURE_QUALITY.md](ARCHITECTURE_QUALITY.md) - Arkitekturkvalitet og forbedringer
- [DEPLOYMENT.md](DEPLOYMENT.md) - Hovedguide for deploy
- [EXTERNAL_DEPLOYMENT.md](EXTERNAL_DEPLOYMENT.md) - Alternativ deploy (Vercel/Render)
- [DATABASE_ARCHITECTURE.md](../backend/docs/DATABASE_ARCHITECTURE.md) - Database-valg
