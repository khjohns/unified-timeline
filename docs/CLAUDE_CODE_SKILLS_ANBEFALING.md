# Claude Code Skills - Vurdering og Anbefaling

> Dokument opprettet: 2025-01-11
> Kontekst: Unified Timeline / Skjema Endringsmeldinger

## Bakgrunn

Dette dokumentet vurderer hvilke Claude Code skills som er relevante for denne kodebasen, basert på prosjektets kompleksitet, domene og eksisterende verktøy.

## Prosjektkarakteristikker

| Aspekt | Beskrivelse |
|--------|-------------|
| **Domene** | Byggebransje, endringsordrer etter NS 8407:2011 |
| **Arkitektur** | Event Sourcing + CQRS |
| **Stack** | React 19 + TypeScript (frontend), Flask + Python (backend) |
| **Database** | Supabase (PostgreSQL) |
| **Kompleksitet** | Høy - juridisk domene, tre parallelle spor, flere sakstyper |

---

## Anbefalte Skills

### 1. Event Sourcing & Datamodell

**Prioritet:** 🔴 Høy

**Begrunnelse:** Arkitekturen er ikke-triviell og krever forståelse av:
- Event-flyt fra frontend → backend → Supabase
- Tre-spor-modellen (Grunnlag, Vederlag, Frist)
- Sakstyper (standard, forsering, endringsordre)
- State-projeksjoner og optimistisk låsing
- CloudEvents v1.0-format

**Skill-innhold bør dekke:**
- Oversikt over event-typer definert i `backend/models/events.py`
- Hvordan `SakState` projiseres fra events
- Regler for når events kan/ikke kan sendes
- Eksempler på vanlige event-sekvenser

**Relevante filer:**
- `backend/models/events.py` (1575 linjer)
- `backend/models/sak_state.py` (1122 linjer)
- `backend/services/timeline_service.py` (1184 linjer)
- `docs/ARCHITECTURE_AND_DATAMODEL.md` (93 KB)

---

### 2. Supabase & Database

**Prioritet:** 🟠 Medium

**Begrunnelse:** Database-interaksjon er sentralt, men godt dokumentert.

**Skill-innhold bør dekke:**
- Event store-struktur
- Hvordan lese/skrive events via repository-laget
- Auth-flyt (JWT, magic links, CSRF)
- Miljøvariabler og konfigurasjon

**Relevante filer:**
- `backend/repositories/supabase_event_repository.py`
- `backend/repositories/event_repository.py`
- `docs/SECURITY_ARCHITECTURE.md`

---

### 3. Statisk Analyse (Periodisk Sjekk)

**Prioritet:** 🟠 Medium

**Begrunnelse:** Scripts eksisterer allerede i `/scripts`. En skill kan instruere Claude til å kjøre disse ved passende tidspunkter.

**Eksisterende verktøy:**
| Script | Formål |
|--------|--------|
| `todo_tracker.py` | Sporer TODO/FIXME-kommentarer |
| `security_scan.py` | Sikkerhetssårbarhet-scan |
| `constant_drift.py` | Sjekker synk mellom konstant-definisjoner |
| `contract_drift.py` | Frontend/backend kontrakt-synk |
| `state_drift.py` | State-modell konsistens |
| `label_coverage.py` | Label/i18n dekning |
| `check-contrast.mjs` | Fargekontrast-validering |

**Skill-innhold bør dekke:**
- Når kjøre hvilke scripts
- Hvordan tolke output
- Automatiske sjekker før commit/PR

**Se også:** `docs/STATIC_ANALYSIS_ROADMAP.md`

---

### 4. Testing Guidelines

**Prioritet:** 🟠 Medium

**Begrunnelse:** Prosjektet har omfattende test-oppsett som krever forståelse.

**Skill-innhold bør dekke:**

**Frontend (Vitest + Playwright):**
- Når skrive unit vs. integration vs. E2E
- A11y-testing med jest-axe
- Hvordan bruke `npm run test:*` kommandoer

**Backend (Pytest):**
- Fixture-bruk i `backend/tests/fixtures/`
- Mocking av Supabase
- Service vs. API-tester

**Kommandoreferanse:**
```bash
# Frontend
npm run test              # Unit/integration
npm run test:a11y         # Tilgjengelighet
npm run test:e2e          # End-to-end

# Backend
cd backend && make test   # Pytest
cd backend && make test-cov
```

---

### 5. Commit & PR Standards

**Prioritet:** 🟢 Lav-Medium

**Begrunnelse:** Konsistent historikk og god PR-praksis.

**Skill-innhold bør dekke:**
- Conventional commits format (feat, fix, refactor, docs, etc.)
- Hva inkludere i PR description
- Sjekkliste før commit:
  - [ ] Tester passerer
  - [ ] Linting OK (`npm run lint`)
  - [ ] Statisk analyse (relevante scripts)
  - [ ] TypeScript kompilerer

---

### 6. API Dokumentasjon

**Prioritet:** 🟢 Lav

**Begrunnelse:** God eksisterende dokumentasjon, men nyttig som referanse.

**Skill-innhold bør dekke:**
- OpenAPI-generering (`npm run openapi:generate`)
- Endpoint-oversikt fra `backend/routes/`
- Catenda-integrasjons API

**Relevante filer:**
- `docs/Dalux-DaluxBuild-api-4.13-resolved.json`
- `backend/routes/*.py`

---

### 7. Design System & Tilgjengelighet

**Prioritet:** 🟢 Lav

**Begrunnelse:** Oslo Kommune Punkt har egen dokumentasjon.

**Skill-innhold bør dekke:**
- Punkt Design System komponenter
- WCAG 2.1 AA krav
- Radix UI primitives bruk
- Fargekontrast-validering

---

## Skills som IKKE anbefales å lage

### NS 8407 Kontraktsreferanse

**Begrunnelse:** Claude har ikke direkte tilgang til kontraktsteksten i sitt miljø. En slik skill ville kreve:
- Ekstern dokumentasjon eller API
- Manuelt vedlikehold av kontraktsutdrag
- Risiko for feil eller utdatert informasjon

**Alternativ:** Bruk eksisterende kommentarer i koden som refererer til paragrafer, samt `docs/ARCHITECTURE_AND_DATAMODEL.md` som forklarer kontraktsbegreper i kontekst.

---

## Implementeringsrekkefølge

```
Fase 1 (Umiddelbar verdi):
├── Event Sourcing & Datamodell
└── Statisk Analyse (periodisk)

Fase 2 (Kvalitetssikring):
├── Testing Guidelines
└── Commit & PR Standards

Fase 3 (Referansemateriale):
├── Supabase & Database
├── API Dokumentasjon
└── Design System
```

---

## Teknisk implementering

Claude Code skills kan implementeres som:

1. **CLAUDE.md** - Prosjekt-level instruksjoner
2. **`.claude/skills/`** - Dedikerte skill-filer
3. **Session hooks** - Automatiske sjekker ved oppstart

### Forslag til mappestruktur

```
.claude/
├── settings.json           # Claude Code konfigurasjon
├── CLAUDE.md              # Hoved-instruksjoner
└── skills/
    ├── event-sourcing.md  # Arkitektur-guide
    ├── static-analysis.md # Analyse-instruksjoner
    ├── testing.md         # Test-guidelines
    └── commit.md          # Commit-standards
```

---

## Neste steg

1. Velg hvilke skills som skal implementeres først
2. Opprett `.claude/` mappestruktur
3. Skriv skill-filer basert på eksisterende dokumentasjon
4. Test skills i praksis og iterer

---

## Referanser

- [Claude Code dokumentasjon](https://docs.anthropic.com/claude-code)
- `docs/ARCHITECTURE_AND_DATAMODEL.md`
- `docs/STATIC_ANALYSIS_ROADMAP.md`
- `docs/FRONTEND_ARCHITECTURE.md`
- `docs/SECURITY_ARCHITECTURE.md`
