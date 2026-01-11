# Static Analysis Roadmap

> Kartlegging av kodebasen og anbefalinger for nye statisk analyse-verktøy.
> Generert: 2026-01-11

## Innhold

1. [Eksisterende Verktøy](#eksisterende-verktøy)
2. [Kartleggingsfunn](#kartleggingsfunn)
3. [Kritiske Bugs Oppdaget](#kritiske-bugs-oppdaget)
4. [Anbefalte Nye Verktøy](#anbefalte-nye-verktøy)
5. [Implementasjonsplan](#implementasjonsplan)

---

## Eksisterende Verktøy

Tre drift-detektorer er allerede implementert:

| Script | Formål | Status |
|--------|--------|--------|
| `scripts/contract_drift.py` | Sammenligner TS union types med Python Enums | ✅ Operativ |
| `scripts/state_drift.py` | Sammenligner TS interfaces med Pydantic models | ✅ Operativ |
| `scripts/check_drift.py` | Unified wrapper med samlet rapport | ✅ Operativ |

### Resultater fra første kjøring

**Contract Drift:**
- `EventType`: 11 event-typer var ute av synk (nå fikset)
- `SporType`: 'forsering' manglet i Python (nå fikset)

**State Model Drift:**
- 22 kritiske felt-mismatches
- 14 optional/required advarsler
- Eksempel: `SakState.catenda_topic_id` mangler i TypeScript

---

## Kartleggingsfunn

### Frontend/Backend Synkroniseringspunkter

Følgende områder krever manuell synkronisering og er høyrisiko for drift:

| Område | Frontend | Backend | Risiko |
|--------|----------|---------|--------|
| **EventType** | `timeline.ts` (30+ typer) | `events.py` Enum | KRITISK |
| **SporType** | `timeline.ts` (3 typer) | `events.py` Enum | KRITISK |
| **Kategorier** | `categories.ts` (28 kombo) | `grunnlag_categories.py` | KRITISK |
| **VederlagsMetode** | `paymentMethods.ts` (3) | `vederlag_methods.py` | KRITISK |
| **Response Results** | `timeline.ts` + `responseOptions.ts` | `events.py` Enums | KRITISK |
| **Event Labels** | `eventTypeLabels.ts` (39) | (ingen backend) | HØY |
| **SubsidiaerTrigger** | `timeline.ts` (9 verdier) | `events.py` Enum | HØY |
| **API Routes** | `src/api/*.ts` | `routes/*.py` | HØY |
| **Approval Config** | `approvalConfig.ts` | (mangler backend?) | MEDIUM |

### Hardkodede Verdier

Følgende verdier er duplisert på flere steder uten sentral konfigurasjon:

#### Dagmulktsats (50000 NOK/dag)

| Fil | Linje | Kontekst |
|-----|-------|----------|
| `src/pages/CasePage.tsx` | 829 | `dagmulktsats={50000}` - har TODO |
| `src/api/analytics.ts` | 210 | Mock data |
| `__mocks__/timelines/timeline-006.ts` | 32 | Mock data |
| `backend/scripts/create_test_sak.py` | 341 | Test default |

#### Forseringsmultiplier (1.3 = 30%)

| Fil | Linje |
|-----|-------|
| `src/components/views/EventDetailModal.tsx` | 1278 |
| `src/components/actions/SendForseringModal.tsx` | 211 |
| `src/components/forsering/BHResponsForseringModal.tsx` | 855 |
| `backend/services/forsering_service.py` | 87, 286 |
| `backend/services/timeline_service.py` | 525 |
| `backend/scripts/create_test_sak.py` | 345 |

#### API Base URLs

| Fil | Verdi |
|-----|-------|
| `src/api/client.ts` | `http://localhost:8080` |
| `src/context/AuthContext.tsx` | `http://localhost:8080` |
| `e2e/fixtures.ts` | `http://localhost:8080` |
| `backend/scripts/create_test_sak.py` | `http://localhost:3000`, `http://localhost:5000` |

### TODO/FIXME Kommentarer

Totalt 10 kritiske kommentarer funnet:

| Fil | Linje | Kommentar | Alvorlighet |
|-----|-------|-----------|-------------|
| `src/api/events.ts` | 20 | Rolle hentes fra localStorage, ikke Catenda API | HØY |
| `src/pages/CasePage.tsx` | 829 | dagmulktsats hardkodet, TODO: Get from config | MEDIUM |
| `src/pages/EndringsordePage.tsx` | 359 | Modals for aksepter/bestrid/revider ikke implementert | HØY |
| `backend/services/catenda_service.py` | 69, 84 | Azure Service Bus mangler | KRITISK |
| `backend/services/webhook_service.py` | 280 | Azure Service Bus mangler | KRITISK |
| `backend/services/catenda_sync_service.py` | 136 | PDF-upload for forsering ikke implementert | MEDIUM |
| `backend/models/events.py` | 1598 | Legacy data-migrering ikke fullført | LAV |

### Test-Dekning

| Område | Antall | Testet | Dekning |
|--------|--------|--------|---------|
| Hooks | 13 | 1 | 8% |
| Pages | 9 | 0 | 0% |
| Contexts | 5 | 0 | 0% |
| API-filer | 7 | 3 | 43% |

**Utestående hooks uten test:**
- `useAnalytics.ts` (7 analytics hooks)
- `useCaseList.ts`
- `useApprovalWorkflow.ts`
- `useRevisionHistory.ts`
- `useStandpunktEndringer.ts`
- `useUserRole.ts`
- `useFormBackup.ts`

### Observerbarhets-Hull

| Problem | Fil | Konsekvens |
|---------|-----|------------|
| Silent localStorage failures | `useFormBackup.ts` | Bruker tror data er lagret |
| Token race conditions | `useSubmitEvent.ts` | Token kan expire mellom verify og submit |
| Optional error callbacks | Alle action modals | `onCatendaWarning` kan være undefined |
| JSON.parse uten validering | `ApprovalContext.tsx` | State corruption mulig |
| Ingen strukturert logging | Frontend generelt | Produksjons-bugs usynlige |

---

## Kritiske Bugs Oppdaget

### 1. `harEndringer` alltid `true`

**Fil:** `src/components/actions/ReviseVederlagModal.tsx:286`

```typescript
const harEndringer = true;  // ← ALLTID TRUE!
```

**Konsekvens:** Bruker kan sende revisjon uten å faktisk endre noe.

**Anbefaling:** Fiks umiddelbart - dette er en funksjonell bug.

### 2. Math.random() for ID-generering

**Filer:**
- `src/api/forsering.ts:240`
- `src/api/endringsordre.ts:394`
- `src/pages/OpprettSakPage.tsx:64`
- `src/utils/fileUtils.ts:7`

**Konsekvens:** `Math.random()` er ikke kryptografisk sikker. SAK-IDer kan være forutsigbare.

**Anbefaling:** Bruk `crypto.randomUUID()` eller backend-genererte IDer.

### 3. Roller i localStorage

**Filer:**
- `src/context/UserRoleContext.tsx:75, 79`
- `src/api/events.ts:21, 30`

**Konsekvens:** XSS-angrep kan manipulere brukerroller.

**Anbefaling:** Hent roller fra backend ved hver request, eller bruk httpOnly cookies.

### 4. Azure Service Bus TODO

**Filer:**
- `backend/services/catenda_service.py:69, 84`
- `backend/services/webhook_service.py:280`

**Konsekvens:** Webhook-prosessering er synkron - kan blokkere ved høy last.

**Anbefaling:** Implementer Azure Service Bus før produksjon.

---

## Anbefalte Nye Verktøy

### Prioritet 1: KRITISK

#### 1.1 Hardcoded Constants Detector

**Formål:** Finn dupliserte hardkodede verdier som bør sentraliseres.

**Sjekker:**
- Tall som gjentas 3+ ganger (50000, 1.3, etc.)
- URL-strenger
- Magic strings

**Forventet output:**
```
DUPLICATED CONSTANT: 50000
  Locations: 4
  - src/pages/CasePage.tsx:829
  - src/api/analytics.ts:210
  - __mocks__/timelines/timeline-006.ts:32
  - backend/scripts/create_test_sak.py:341
  Suggestion: Create DAGMULKTSATS constant

DUPLICATED CONSTANT: 1.3
  Locations: 7
  ...
```

#### 1.2 Label Coverage Checker

**Formål:** Sikre at alle enum-verdier har tilhørende labels.

**Sjekker:**
- `eventTypeLabels.ts` dekker alle `EventType`-verdier
- `responseOptions.ts` dekker alle resultat-enums
- `SUBSIDIAER_TRIGGER_LABELS` dekker alle triggers

**Forventet output:**
```
MISSING LABELS: EventType
  - eo_sluttoppgjor (no label in eventTypeLabels.ts)
  - forsering_akseptert (no label in eventTypeLabels.ts)

OK: VederlagBeregningResultat (4/4 labels)
OK: FristBeregningResultat (3/3 labels)
```

#### 1.3 Validation Symmetry Checker

**Formål:** Sikre at frontend og backend validerer likt.

**Sjekker:**
- Zod schemas vs Pydantic validators
- Required/optional mismatch
- Type constraints (min/max, regex patterns)

### Prioritet 2: HØY

#### 2.1 TODO Tracker

**Formål:** Spor kritiske TODOs over tid.

**Sjekker:**
- Finn alle TODO/FIXME/HACK/XXX
- Kategoriser etter severity (basert på nøkkelord)
- Sammenlign med forrige kjøring (nye vs løste)

#### 2.2 Security Pattern Scanner

**Formål:** Finn potensielle sikkerhetsrisikoer.

**Sjekker:**
- `Math.random()` i ID-kontekst
- Sensitiv data i localStorage
- Hardkodede secrets/tokens
- SQL/command injection patterns

#### 2.3 Category Drift Detector

**Formål:** Sammenlign kategori-strukturer.

**Filer:**
- `src/constants/categories.ts`
- `backend/constants/grunnlag_categories.py`

**Sjekker:**
- Alle hovedkategorier matcher
- Alle underkategorier matcher
- Metadata-felt er konsistente (hjemmel_basis, varselkrav_ref)

### Prioritet 3: MEDIUM

#### 3.1 API Route Mapper

**Formål:** Verifiser at frontend API-kall matcher backend routes.

#### 3.2 Test Gap Finder

**Formål:** Identifiser kode uten test-dekning.

#### 3.3 Silent Error Detector

**Formål:** Finn steder hvor feil ignoreres stille.

---

## Implementasjonsplan

### Fase 1: Umiddelbar (denne uken)

1. **Fiks `harEndringer` bug** - kritisk funksjonell feil
2. **Implementer Hardcoded Constants Detector** - høy verdi, enkel implementasjon
3. **Implementer Label Coverage Checker** - forhindrer runtime-feil

### Fase 2: Kort sikt (neste sprint)

4. **Implementer TODO Tracker** - viktig for teknisk gjeld-sporing
5. **Implementer Security Pattern Scanner** - nødvendig før produksjon
6. **Implementer Category Drift Detector** - kompletterer eksisterende contract_drift

### Fase 3: Medium sikt

7. **API Route Mapper**
8. **Test Gap Finder**
9. **Silent Error Detector**
10. **Validation Symmetry Checker**

### CI-Integrasjon

Alle verktøy bør støtte:
- `--ci` flag med exit code 1 ved kritiske funn
- `--format json` for maskinlesbar output
- `--format markdown` for PR-kommentarer

Anbefalt GitHub Actions workflow:

```yaml
name: Static Analysis

on: [push, pull_request]

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Contract & State Drift
        run: python scripts/check_drift.py --ci

      - name: Hardcoded Constants
        run: python scripts/constant_drift.py --ci

      - name: Label Coverage
        run: python scripts/label_coverage.py --ci

      - name: Security Scan
        run: python scripts/security_scan.py --ci
```

---

## Vedlegg: Komplett Mapping

### EventType (30+ verdier)

```
grunnlag_opprettet, grunnlag_oppdatert, grunnlag_trukket
vederlag_krav_sendt, vederlag_krav_oppdatert, vederlag_krav_trukket
frist_krav_sendt, frist_krav_oppdatert, frist_krav_spesifisert, frist_krav_trukket
respons_grunnlag, respons_grunnlag_oppdatert
respons_vederlag, respons_vederlag_oppdatert
respons_frist, respons_frist_oppdatert
forsering_varsel, forsering_stoppet, forsering_respons, forsering_akseptert, forsering_avslatt
eo_opprettet, eo_sendt, eo_oppdatert, eo_akseptert, eo_avslatt, eo_avbestilt, eo_sluttoppgjor
sak_opprettet
```

### Kategori-Struktur

```
ENDRING (7 underkategorier)
├── EO_PAALEGG
├── EO_IRREGULÆR
├── EO_AVBESTILLING
├── EO_BESTILLING
├── EO_TILLEGG_FUNKSJONSBASERT
├── EO_ANDRE_BYGGHERREINITIERT
└── EO_REGULERING

SVIKT (6 underkategorier)
├── SVIKT_PROSJEKTERING
├── SVIKT_LEVERANSE
├── SVIKT_MEDVIRKNING
├── SVIKT_SAMORDNING
├── SVIKT_KONTRAKTSBRUDD
└── SVIKT_ANDRE

ANDRE (7 underkategorier)
├── ANDRE_VARSEL_BH
├── ANDRE_FORHOLD_GRUNNEIER
├── ANDRE_OFFENTLIGE_PAALEGG
├── ANDRE_UFORUTSETTE_GRUNNFORHOLD
├── ANDRE_UFORUTSETTE_FORHOLD
├── ANDRE_FORCE_MAJEURE
└── ANDRE_LOV_FORSKRIFT

FORCE_MAJEURE (2 underkategorier)
├── FM_NATURKATASTROFE
└── FM_KRIG_PANDEMI
```
