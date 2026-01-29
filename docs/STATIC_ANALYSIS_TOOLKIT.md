# Static Analysis Toolkit - Vurdering og Anbefaling

> Analyse av relevante statisk analyse-verktøy for unified-timeline basert på prosjektets arkitektur og teknologivalg.

## Implementert Verktøy

### Contract Drift Detector

**Status:** Implementert

**Plassering:** `scripts/contract_drift.py`

**Bruk:**
```bash
# Standard output
python scripts/contract_drift.py

# JSON output (for CI/pipelines)
python scripts/contract_drift.py --format json

# Markdown output (for rapporter)
python scripts/contract_drift.py --format markdown

# CI-modus (exit 1 ved kritiske funn)
python scripts/contract_drift.py --ci
```

**Første kjøring fant:**
- `EventType`: event-typer var ute av synk mellom frontend/backend (nå fikset)

### State Model Drift Detector

**Status:** Implementert

**Plassering:** `scripts/state_drift.py`

**Bruk:**
```bash
# Standard output
python scripts/state_drift.py

# JSON output (for CI/pipelines)
python scripts/state_drift.py --format json

# Markdown output (for rapporter)
python scripts/state_drift.py --format markdown

# CI-modus (exit 1 ved kritiske funn)
python scripts/state_drift.py --ci
```

**Hva den sjekker:**
- Sammenligner TypeScript interfaces med Pydantic BaseModel-klasser
- Finner felt som mangler på en av sidene
- Detekterer optional/required mismatches
- Håndterer @computed_field properties i Pydantic

**Første kjøring fant:**
- 22 kritiske felt-mismatches
- 14 optional-mismatch advarsler
- Eksempel: `SakState.catenda_topic_id` mangler i TypeScript

### Unified Drift Checker (Wrapper)

**Plassering:** `scripts/check_drift.py`

**Bruk:**
```bash
# Kjør alle drift-sjekker
python scripts/check_drift.py

# CI-modus
python scripts/check_drift.py --ci
```

**Output:**
```
============================================================
  DRIFT CHECK REPORT
============================================================

CONTRACT DRIFT (Enums/Unions)
  DRIFT FUNNET: 2 typer

STATE MODEL DRIFT (Interfaces/Models)
  DRIFT FUNNET: 7 modeller

============================================================
  TOTALT: 34 kritiske, 14 advarsler
============================================================
```

### Hardcoded Constants Detector

**Status:** Implementert

**Plassering:** `scripts/constant_drift.py`

**Bruk:**
```bash
# Standard output
python scripts/constant_drift.py

# JSON output (for CI/pipelines)
python scripts/constant_drift.py --format json

# Markdown output (for rapporter)
python scripts/constant_drift.py --format markdown

# CI-modus (exit 1 ved kritiske funn)
python scripts/constant_drift.py --ci

# Minimum antall duplikater for å rapportere (default: 3)
python scripts/constant_drift.py --min 5
```

**Hva den sjekker:**
- Tall som gjentas 3+ ganger på tvers av filer
- URL-strenger (localhost, API endpoints)
- Magic strings (UPPERCASE konstanter)

**Eksempel på funn:**
- `50000` (dagmulktsats) - 40 steder, foreslår `DAGMULKTSATS_DEFAULT`
- `1.3` (forseringsmultiplier) - 16 steder, foreslår `FORSERING_MULTIPLIER`
- `http://localhost:8080` - 8 steder, foreslår `API_BASE_URL_DEV`

### Label Coverage Checker

**Status:** Implementert

**Plassering:** `scripts/label_coverage.py`

**Bruk:**
```bash
# Standard output
python scripts/label_coverage.py

# JSON output (for CI/pipelines)
python scripts/label_coverage.py --format json

# Markdown output (for rapporter)
python scripts/label_coverage.py --format markdown

# CI-modus (exit 1 ved manglende labels)
python scripts/label_coverage.py --ci
```

**Hva den sjekker:**
- `EVENT_TYPE_LABELS` dekker alle `EventType`-verdier
- `SUBSIDIAER_TRIGGER_LABELS` dekker alle `SubsidiaerTrigger`-verdier
- `BH_GRUNNLAGSVAR_OPTIONS` dekker alle `GrunnlagResponsResultat`-verdier
- `BH_VEDERLAGSSVAR_OPTIONS` dekker alle `VederlagBeregningResultat`-verdier
- `BH_FRISTSVAR_OPTIONS` dekker alle `FristBeregningResultat`-verdier

### TODO Tracker

**Status:** Implementert

**Plassering:** `scripts/todo_tracker.py`

**Bruk:**
```bash
# Standard output
python scripts/todo_tracker.py

# JSON output (for CI/pipelines)
python scripts/todo_tracker.py --format json

# Markdown output (for rapporter)
python scripts/todo_tracker.py --format markdown

# CI-modus (exit 1 ved kritiske funn)
python scripts/todo_tracker.py --ci

# Filtrer etter severity
python scripts/todo_tracker.py --severity critical
```

**Hva den sjekker:**
- Finner alle TODO/FIXME/HACK/XXX/BUG/NOTE/WARNING kommentarer
- Kategoriserer etter alvorlighetsgrad basert på nøkkelord
- CRITICAL: FIXME, HACK, security-relatert, production, Azure
- HIGH: XXX, important, urgent, blocking
- MEDIUM: refactor, cleanup, optimize
- LOW: Vanlige TODO-kommentarer

**Første kjøring fant:**
- 16 kritiske (Azure Service Bus TODO, auth TODO, security notes)
- 4 høy-prioritet

### Cyclomatic Complexity Analysis

**Status:** Implementert

**Verktøy:**
- Backend (Python): `radon`
- Frontend (TypeScript): Custom script

**Bruk:**
```bash
# Python backend - alle filer med score
radon cc backend/ -a -s

# Python backend - kun komplekse funksjoner (C eller verre)
radon cc backend/ -a -s --min C

# Frontend - custom analyse
node scripts/analyze-frontend-complexity.js
```

**Hva det måler:**
Syklomatisk kompleksitet teller antall uavhengige stier gjennom koden. Beslutningspunkter som `if`, `for`, `while`, `switch`, `&&`, `||` øker kompleksiteten.

**Score-skala:**

| Grad | Kompleksitet | Vurdering |
|------|--------------|-----------|
| A | 1-5 | Enkel, lav risiko |
| B | 6-10 | Moderat |
| C | 11-20 | Kompleks, bør vurderes |
| D | 21-30 | Høy kompleksitet |
| E | 31-40 | Svært høy |
| F | 41+ | Utestbar, må refaktoreres |

**Baseline-måling (januar 2025):**

*Backend (Python):*
- Blokker analysert: 1 946
- Gjennomsnitt: A (3.9) ✅

Kritiske funksjoner (F/E):
| Fil | Funksjon | Score |
|-----|----------|-------|
| `routes/event_routes.py:135` | `submit_event` | F (50) |
| `scripts/dalux_menu.py:264` | `view_full_task_info` | F (64) |
| `services/dalux_sync_service.py:436` | `_map_task_to_topic` | E (37) |
| `routes/event_routes.py:742` | `_post_to_catenda` | E (37) |

*Frontend (TypeScript):*
- Filer analysert: 236
- Total kompleksitet: 6 097
- Gjennomsnitt per fil: 25.8

Mest komplekse filer:
| Fil | Kompleksitet | Linjer |
|-----|--------------|--------|
| `components/actions/RespondVederlagModal.tsx` | 432 | 2387 |
| `components/actions/RespondFristModal.tsx` | 301 | 2062 |
| `components/forsering/BHResponsForseringModal.tsx` | 210 | 1478 |
| `utils/begrunnelseGenerator.ts` | 210 | 1386 |
| `components/StatusAlert/statusAlertGenerator.ts` | 139 | 564 |

**Anbefalinger:**
1. Refaktorer F-graderte funksjoner (`submit_event`, `view_full_task_info`) - disse er utestbare
2. Vurder å splitte store modal-komponenter (>300 kompleksitet)
3. Kjør kompleksitetsanalyse før PR-merge for nye filer

### Security Pattern Scanner

**Status:** Implementert

**Plassering:** `scripts/security_scan.py`

**Bruk:**
```bash
# Standard output
python scripts/security_scan.py

# JSON output (for CI/pipelines)
python scripts/security_scan.py --format json

# Markdown output (for rapporter)
python scripts/security_scan.py --format markdown

# CI-modus (exit 1 ved kritiske funn)
python scripts/security_scan.py --ci

# Inkluder low-severity funn
python scripts/security_scan.py --include-low
```

**Hva den sjekker:**
- `Math.random()` brukt for ID-generering
- Sensitiv data i localStorage/sessionStorage
- Hardkodede secrets/tokens
- Usikre patterns (eval, innerHTML, dangerouslySetInnerHTML)
- SQL injection patterns
- subprocess med shell=True
- CORS med wildcard

**Første kjøring fant:**
- 4 Math.random() brukt for SAK-ID generering
- 1 false positive (SQL-lignende streng som ikke er SQL)

---

## Bakgrunn

Ved AI-assistert utvikling med verktøy som Claude Code genereres kode raskere enn manuell verifisering tillater. Over tid kan små inkonsistenser oppstå - såkalt "drift" - hvor ulike deler av kodebasen divergerer fra hverandre.

Dette dokumentet vurderer hvilke statisk analyse-verktøy som er relevante for dette prosjektet.

## Prosjektets Tech Stack

| Lag | Teknologi |
|-----|-----------|
| Frontend | React 19 + TypeScript 5.8 |
| Backend | Python Flask + Pydantic v2 |
| Database | Supabase (PostgreSQL) |
| Arkitektur | Event Sourcing + CQRS |
| Testing | Vitest + pytest + Playwright |

## Identifiserte Drift-Risikoer

### Høy Risiko

#### 1. Event Type Synkronisering
Frontend og backend definerer samme event-typer manuelt:

```typescript
// src/types/timeline.ts
export type EventType = 'grunnlag_opprettet' | 'vederlag_krav_sendt' | ...
```

```python
# backend/models/events.py
class EventType(str, Enum):
    GRUNNLAG_OPPRETTET = "grunnlag_opprettet"
    VEDERLAG_KRAV_SENDT = "vederlag_krav_sendt"
```

**Risiko:** Nye event-typer legges til på én side, men glemmes på den andre.

#### 2. API Response Kontrakter
Frontend infererer typer fra API-respons, backend definerer eksplisitte Pydantic-modeller:

- Frontend: `src/types/api.ts` - manuelt definert
- Backend: `backend/models/api_responses.py` - 381 LOC
- Backend: `backend/models/sak_state.py` - 1,122 LOC

**Risiko:** Breaking changes i backend-modeller detekteres ikke før runtime.

#### 3. Enum/Konstant Duplisering

| Konstant | Frontend | Backend |
|----------|----------|---------|
| VederlagsMetode | `src/types/timeline.ts` | `backend/constants/vederlag_methods.py` |
| SporType | `src/types/timeline.ts` | `backend/models/events.py` |
| GrunnlagKategorier | Ikke synkronisert | `backend/constants/grunnlag_categories.py` (481 LOC) |

### Medium Risiko

| Område | Detaljer |
|--------|----------|
| Database Schema | Supabase-tabeller vs Pydantic-modeller synces manuelt |
| Valideringsregler | `backend/services/business_rules.py` ikke reflektert i frontend-validering |
| Feilhåndtering | Ulike feilformater mellom frontend og backend |

### Lav Risiko

- UI-komponenter (Radix UI, godt integrert)
- CSS (Tailwind, deterministisk)
- Build-konfigurasjon (Vite + TypeScript strict mode)

## Vurdering av Verktøy fra Reddit-innlegget

Referanse: Reddit-innlegg om 14 CLI-verktøy for Go/TypeScript-kodebase.

### Høy Relevans

| Verktøy | Tilpasning Nødvendig | Prioritet |
|---------|---------------------|-----------|
| **api-contract-drift** | Ja, Python/Pydantic istedenfor Go | P1 |
| **schema-drift-detector** | Ja, Supabase/Pydantic | P2 |
| **code-audit (security)** | Delvis, Flask-spesifikk | P3 |

### Lav Relevans

| Verktøy | Begrunnelse |
|---------|-------------|
| query-complexity-analyzer | Event Sourcing gir enkle queries (append + replay) |
| implementation-test-coverage | Prosjektet har ikke mange implementasjoner av samme interface |
| unused-repository-methods | Python har eksisterende verktøy (Pylint, vulture) |
| service-dependency-graph | Flask-arkitekturen er flat, ikke dyp service-graf |

## Anbefaling

### Fase 1: Contract Drift Detector (Anbefalt å starte her)

Et Python-script som:

1. **Parser Pydantic-modeller** i `backend/models/`
2. **Parser TypeScript-typer** i `src/types/`
3. **Sammenligner**:
   - Enum-verdier (EventType, VederlagsMetode, SporType)
   - Interface-felt og typer
   - Optional/required status
4. **Rapporterer** mismatches med severity-nivåer

**Forventet output:**
```
$ python scripts/contract-drift.py

DRIFT DETECTED: EventType
  - MissingInTS: 'eo_sluttoppgjor' (Backend has it, Frontend doesn't)

DRIFT DETECTED: VederlagKompensasjon
  - TypeMismatch: 'belop_direkte' (Backend: Optional[Decimal], TS: number)
  - MissingInTS: 'fradrag_prosent' (Backend has it, Frontend doesn't)

Summary: 2 critical, 1 warning
```

**Implementasjonsplan:**
1. Bruk `ast` for å parse Python Pydantic-modeller
2. Bruk `typescript` parser (via Node.js) eller regex for TypeScript
3. Definer mapping-regler (Python → TypeScript typer)
4. Output: text, JSON, markdown

### Fase 2: Schema Drift Detector

Sammenligner:
- Supabase-tabelldefinisjoner (fra SQL eller Supabase API)
- Pydantic-modeller i `backend/models/`

**Sjekker:**
- Manglende kolonner i modell
- Manglende felt i database
- Type-mismatches
- Nullable-mismatch (Optional i Python vs NULL i SQL)

### Fase 3: Security Audit (Tilpasset Flask)

Statiske sjekker for:
- SQL injection i raw queries
- CSRF-beskyttelse på muterende endpoints
- Rate limiting på sensitive endpoints
- Credential-lekkasje i kode

## Alternativ: Generering istedenfor Deteksjon

Istedenfor å detektere drift, kan man eliminere det ved å generere typer:

| Tilnærming | Fordeler | Ulemper |
|------------|----------|---------|
| **Pydantic → TypeScript** (pydantic-to-typescript) | Single source of truth | Krever build-step |
| **OpenAPI spec** | Standardisert, verktøystøtte | Mer oppsett |
| **JSON Schema** | Allerede støttet av Pydantic | Manuell TS-generering |

**Anbefaling:** Start med deteksjon (contract-drift) for å forstå omfanget, vurder deretter generering for langsiktig løsning.

## CI-Integrasjon

Anbefalt CI-konfigurasjon for alle implementerte verktøy:

```yaml
# .github/workflows/static-analysis.yml
name: Static Analysis

on: [push, pull_request]

jobs:
  static-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Contract & State Drift Check
        run: python scripts/check_drift.py --ci

      - name: Label Coverage Check
        run: python scripts/label_coverage.py --ci

      - name: Hardcoded Constants Check
        run: python scripts/constant_drift.py --ci --min 5
        # Advarsel: --min 3 vil gi mange funn, bruk --min 5 for CI

      - name: TODO Tracker
        run: python scripts/todo_tracker.py --severity critical --ci
        # Blokkerer ved kritiske TODOs (FIXME, HACK, security)

      - name: Security Scan
        run: python scripts/security_scan.py --ci
        # Blokkerer ved kritiske sikkerhetsfunn
```

## Konklusjon

Konseptene fra Reddit-innlegget er relevante, men verktøyene må tilpasses fra Go til Python/TypeScript.

**Prioritert rekkefølge:**
1. Contract Drift Detector (TypeScript ↔ Pydantic)
2. Schema Drift Detector (Supabase ↔ Pydantic)
3. Security Audit (Flask-spesifikk)

Start med verktøy #1 som gir mest verdi for innsatsen i denne kodebasen.
