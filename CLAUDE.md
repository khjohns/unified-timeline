# Unified Timeline - Claude Code Context

## Prosjektoversikt

Dette er en digital samhandlingsplattform for håndtering av endringsordrer (KOE - Krav om Endring) i byggeprosjekter etter NS 8407:2011 totalentreprisekontrakten.

## Tech Stack

| Lag | Teknologi |
|-----|-----------|
| Frontend | React 19 + TypeScript 5.8 + Vite |
| Backend | Flask + Python 3.11 + Pydantic v2 |
| Database | Supabase (PostgreSQL) |
| Arkitektur | Event Sourcing + CQRS |
| Testing | Vitest (unit), Playwright (e2e), Pytest (backend) |

## Viktige Arkitekturbegreper

### Tre-Spor-Modellen

Hver sak har tre uavhengige spor som behandles parallelt:

| Spor | Spørsmål | Hjemmel |
|------|----------|---------|
| **Grunnlag** | Har TE krav på endring? (Ansvar) | §25.2 |
| **Vederlag** | Hva koster det? | §34 |
| **Frist** | Hvor lang tid trengs? | §33 |

### Sakstyper

- `standard` - Ordinær KOE-sak
- `forsering` - Akselerasjon etter §33.8
- `endringsordre` - Formell EO etter §31.3

### Roller

**Domeneroller** (NS 8407-kontekst):
- **TE** (Totalentreprenør) - Sender krav
- **BH** (Byggherre) - Responderer på krav

**Prosjektroller** (tilgangsstyring):
- **admin** - Full tilgang, kan administrere medlemmer
- **member** - Kan lese og skrive i prosjektet
- **viewer** - Kun lesetilgang

### Multi-prosjekt og tilgangsstyring

Plattformen støtter flere prosjekter med prosjektbasert tilgangsstyring:

- **Email-basert medlemskap** - `project_memberships`-tabellen bruker `user_email` (ikke UUID), kompatibelt med både magic links og fremtidig Entra ID
- **`OPEN_ACCESS_PROJECTS`** - Standardprosjektet `oslobygg` har åpen tilgang (bakoverkompatibilitet)
- **`@require_project_access`-dekoratør** - Påkrevd på alle API-endepunkter, sjekker medlemskap og rolle
- **`X-Project-ID` header** - Frontend sender aktivt prosjekt-ID med alle API-kall
- **Entra ID-klar** - `external_id`-felt i membership-tabellen reservert for fremtidig `oid`-claim

## Mappestruktur

```
src/
├── api/           # API-klienter (client.ts, membership.ts, etc.)
├── components/    # React komponenter
├── context/       # React contexts (Auth, Project, UserRole, Theme)
├── hooks/         # Custom hooks (React Query wrappers)
├── pages/         # Sideruter
├── types/         # TypeScript typer
└── constants/     # Konstanter

backend/
├── core/          # Config, DI-container, CORS, middleware
├── lib/auth/      # Auth-dekoratører (@require_magic_link, @require_project_access)
├── models/        # Event + State + Membership modeller (Pydantic v2)
├── services/      # Forretningslogikk
├── routes/        # API endpoints (Flask blueprints)
└── repositories/  # Database-lag (Supabase + in-memory for test)
```

## Kommandoer

```bash
# Frontend
npm run dev            # Start dev server
npm run test           # Unit tester
npm run test:e2e       # E2E tester
npm run lint           # Linting

# Backend
cd backend && make test    # Pytest
cd backend && make run     # Flask server

# Statisk analyse
python scripts/check_drift.py       # Synk-sjekk
python scripts/docs_drift.py        # Dokumentasjon-sjekk
python scripts/todo_tracker.py      # TODO-sporing
python scripts/security_scan.py     # Sikkerhetsscan
```

## Før du endrer kode

1. **Les relevante filer først** - Forstå eksisterende struktur
2. **Sjekk synkronisering** - Frontend/backend må matche for events og typer
3. **Kjør tester** - `npm run test` og `cd backend && make test`
4. **Kjør statisk analyse** ved behov - Se scripts i `/scripts`

## Viktige filer å kjenne til

| Fil | Innhold |
|-----|---------|
| `backend/models/events.py` | Alle event-typer og data-modeller |
| `backend/models/sak_state.py` | State-projeksjoner |
| `backend/core/container.py` | DI-container (lazy-loaded repositories og services) |
| `backend/lib/auth/project_access.py` | `@require_project_access` dekoratør + rollesjekk |
| `backend/routes/membership_routes.py` | CRUD for prosjektmedlemskap |
| `src/types/timeline.ts` | Frontend TypeScript typer |
| `src/context/ProjectContext.tsx` | Aktiv prosjekt-kontekst + API-synk |
| `src/constants/categories.ts` | Grunnlag-kategorier |
| `docs/ARCHITECTURE_AND_DATAMODEL.md` | Detaljert arkitektur |

## Auth-arkitektur

Autentisering og autorisering skjer i to lag:

1. **`@require_magic_link`** - Verifiserer Supabase-token, setter `request.magic_link_data`
2. **`@require_project_access(min_role="viewer")`** - Sjekker prosjektmedlemskap via `X-Project-ID` header

Dekoratør-rekkefølge er viktig - `@require_project_access` må komme ETTER `@require_magic_link` (nærmere funksjonen):

```python
@bp.route("/api/endpoint")
@require_magic_link        # Kjøres først
@require_project_access()  # Kjøres etter, leser fra request.magic_link_data
def endpoint():
    ...
```

Backend bruker Supabase **service_role key** (bypasser RLS). RLS er et forsvarslag, ikke primær tilgangskontroll.

## Designsystem

Prosjektet bruker **Punkt-designsystemet** fra Oslo kommune med Tailwind CSS v4.

### Styling-konvensjoner

| Element | Tailwind-klasse | Eksempel |
|---------|-----------------|----------|
| Kort/containere | `rounded-lg` | Modaler, error-bokser, cards |
| Mindre elementer | `rounded-sm` | Badges, inputs, alerts |
| Pills/indikatorer | `rounded-full` | Status-dots, tags |
| Knapper | `rounded-md` | Primær/sekundær buttons |

### Farger

Bruk semantiske CSS-variabler fra `src/index.css`:
- Bakgrunn: `bg-pkt-bg-default`, `bg-pkt-bg-card`, `bg-pkt-bg-subtle`
- Tekst: `text-pkt-text-body-default`, `text-pkt-text-body-subtle`
- Border: `border-pkt-border-default`, `border-pkt-grays-gray-200`
- Alerts: `bg-alert-{info|success|warning|danger}-bg`

### Font

**Oslo Sans** - lastes fra `/fonts/`. Ikke bruk andre fonter.

## Eksterne API-integrasjoner

| API | Dokumentasjon | Kode |
|-----|---------------|------|
| **Catenda** | Se under | `backend/services/catenda_service.py` |
| **Dalux** | `docs/Dalux-DaluxBuild-api-4.13-resolved.json` | – |

### Catenda API-dokumentasjon

Rot-URL `developers.catenda.com` gir ofte 404. Bruk spesifikke undersider:

| Ressurs | URL |
|---------|-----|
| Document API | [developers.catenda.com/document-api](https://developers.catenda.com/document-api) |
| BCF/OpenCDE | [developers.catenda.com/bcf](https://developers.catenda.com/bcf) |
| Model API | [developers.catenda.com/model-api](https://developers.catenda.com/model-api) |

**Tips:** Bruk WebSearch først for å finne riktige URL-er, deretter WebFetch på spesifikke sider.

Se også: `docs/dalux-catenda-integrasjon.md` for integrasjonsplan, kravvurdering og mapping.

## Skills

Mer detaljerte guider finnes i `.claude/skills/`:

- `event-sourcing/SKILL.md` - Event Sourcing arkitektur
- `static-analysis/SKILL.md` - Statisk analyse verktøy
- `accessibility/SKILL.md` - WCAG tilgjengelighet og kontrastsjekk
- `ns8407/SKILL.md` - NS 8407:2011 kontraktsreferanse og kategorimapping
- `docs-update/SKILL.md` - Dokumentasjonsvedlikehold og synkroniseringssjekk
