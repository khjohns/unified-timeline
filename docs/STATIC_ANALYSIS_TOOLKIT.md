# Static Analysis Toolkit - Vurdering og Anbefaling

> Analyse av relevante statisk analyse-verktøy for unified-timeline basert på prosjektets arkitektur og teknologivalg.

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

Når verktøy er implementert, anbefalt CI-konfigurasjon:

```yaml
# .github/workflows/static-analysis.yml
name: Static Analysis

on: [push, pull_request]

jobs:
  contract-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: python scripts/contract-drift.py --ci
        # Blokkerer PR ved kritiske funn
```

## Konklusjon

Konseptene fra Reddit-innlegget er relevante, men verktøyene må tilpasses fra Go til Python/TypeScript.

**Prioritert rekkefølge:**
1. Contract Drift Detector (TypeScript ↔ Pydantic)
2. Schema Drift Detector (Supabase ↔ Pydantic)
3. Security Audit (Flask-spesifikk)

Start med verktøy #1 som gir mest verdi for innsatsen i denne kodebasen.
