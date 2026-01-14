---
name: static-analysis
description: Statiske analyseverktøy for drift-sjekk, sikkerhetsscan og kodekvalitet. Bruk før commit eller for å finne synkroniseringsproblemer.
allowed-tools: Bash, Read, Grep
---

# Statisk Analyse

## Oversikt

Prosjektet har flere statiske analyse-verktøy i `/scripts` som hjelper med å oppdage drift, TODOs, sikkerhetsproblemer og andre potensielle feil.

## Tilgjengelige verktøy

| Script | Formål | Når bruke |
|--------|--------|-----------|
| `check_drift.py` | Samlet drift-sjekk | Før commit, etter større endringer |
| `contract_drift.py` | Enum/union synk | Etter endring av event-typer |
| `state_drift.py` | State-modell synk | Etter endring av state-strukturer |
| `constant_drift.py` | Hardkodede verdier | Ved mistanke om duplikater |
| `label_coverage.py` | Label-dekning | Etter nye enum-verdier |
| `todo_tracker.py` | TODO/FIXME-sporing | Jevnlig, før release |
| `security_scan.py` | Sikkerhetssårbarheter | Før commit, før release |
| `docs_drift.py` | Dokumentasjon vs kode | Før release, etter refaktorering |

### Avanserte flagg

| Script | Flagg | Beskrivelse |
|--------|-------|-------------|
| `security_scan.py` | `--include-low` | Inkluder low-severity funn (ekskludert som default) |
| `contract_drift.py` | `--verbose`, `-v` | Vis hvilke unions/enums som ble funnet |
| `state_drift.py` | `--verbose`, `-v` | Vis hvilke interfaces/models som ble funnet |
| `constant_drift.py` | `--min N` | Minimum forekomster for å rapportere (default: 3) |
| `docs_drift.py` | `--verbose`, `-v` | Vis alle funn inkludert info-nivå |

## Bruksmønster

### Standard output

```bash
python scripts/todo_tracker.py
python scripts/security_scan.py
```

### JSON output (for videre prosessering)

```bash
python scripts/check_drift.py --format json
python scripts/todo_tracker.py --format json
```

### CI-modus (exit 1 ved kritiske funn)

```bash
python scripts/check_drift.py --ci
python scripts/security_scan.py --ci
python scripts/todo_tracker.py --ci --severity critical
```

## Når kjøre hva

### Før hver commit

```bash
# Minimumsjekk
python scripts/check_drift.py
npm run lint
```

### Etter endring av event-typer

```bash
python scripts/contract_drift.py
python scripts/label_coverage.py
```

### Etter endring av state-modeller

```bash
python scripts/state_drift.py
```

### Før PR / code review

```bash
python scripts/check_drift.py
python scripts/docs_drift.py
python scripts/todo_tracker.py
python scripts/security_scan.py
```

### Periodisk (ukentlig/sprint)

```bash
python scripts/constant_drift.py     # Finn dupliserte verdier
python scripts/todo_tracker.py       # Spor teknisk gjeld
```

## Tolke output

### check_drift.py

```
============================================================
  DRIFT CHECK REPORT
============================================================

CONTRACT DRIFT (Enums/Unions)
----------------------------------------
  OK - Ingen drift                    <- Alt synkronisert

STATE MODEL DRIFT (Interfaces/Models)
----------------------------------------
  DRIFT FUNNET: 2 modeller            <- Må fikses!
    - SakState: 3 kritiske, 1 advarsler
    - VederlagTilstand: 1 kritiske, 0 advarsler
```

**Handling ved drift:**
1. Kjør individuelt script for detaljer
2. Oppdater enten frontend eller backend for å matche
3. Kjør sjekk igjen for å verifisere

### todo_tracker.py

```
TODO TRACKER REPORT
==================

CRITICAL (2):
  backend/services/catenda_service.py:69
    FIXME: Azure Service Bus mangler

  backend/services/webhook_service.py:280
    FIXME: Azure Service Bus integration needed

HIGH (3):
  ...
```

**Severity-nivåer:**
- `CRITICAL` - Må fikses før produksjon
- `HIGH` - Bør fikses snart
- `MEDIUM` - Planlegg å fikse
- `LOW` - Nice to have

### security_scan.py

```
SECURITY SCAN REPORT
====================

CRITICAL:
  Math.random() for ID generation
    src/api/forsering.ts:240
    src/pages/OpprettSakPage.tsx:64

HIGH:
  Sensitive data in localStorage
    src/context/UserRoleContext.tsx:75
```

**Handling:**
- `CRITICAL` - Fiks umiddelbart
- `HIGH` - Fiks før produksjon
- `MEDIUM` - Vurder risiko

## CI/CD Integrasjon

Anbefalt GitHub Actions workflow:

```yaml
name: Static Analysis

on: [push, pull_request]

jobs:
  analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Drift Check
        run: python scripts/check_drift.py --ci

      - name: Security Scan
        run: python scripts/security_scan.py --ci

      - name: TODO Check (warn only)
        run: python scripts/todo_tracker.py --severity critical
        continue-on-error: true
```

## Legge til nye sjekker

Alle scripts følger samme mønster:

1. `--format` parameter (text/json/markdown)
2. `--ci` parameter for exit code 1 ved kritiske funn
3. Finner prosjektrot via `package.json`
4. Hopper over `node_modules`, `.git`, `dist`, etc.

Se eksisterende scripts for template.

## Kjente begrensninger

- Scripts er Python-baserte, krever Python 3.11+
- Noen sjekker er regex-baserte og kan gi false positives
- `state_drift.py` sammenligner kun navnede felt, ikke logikk
