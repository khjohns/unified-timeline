---
name: docs-update
description: Dokumentasjonsvedlikehold og synkroniseringssjekk. Bruk etter større endringer, før release, eller når du mistenker utdatert dokumentasjon.
allowed-tools: Bash, Read, Grep
---

# Dokumentasjonsoppdatering

## Oversikt

Denne skillen hjelper med å holde prosjektdokumentasjonen synkronisert med koden. Den inkluderer et automatisert script for drift-deteksjon og retningslinjer for manuell oppdatering.

## Sentrale dokumenter

| Dokument | Innhold | Oppdateres ved |
|----------|---------|----------------|
| `README.md` | Prosjektoversikt, teknologier, struktur | Større arkitekturendringer |
| `CLAUDE.md` | Claude Code kontekst | Nye mapper, kommandoer, skills |
| `docs/ARCHITECTURE_AND_DATAMODEL.md` | Event sourcing, datamodeller | Event-type endringer |
| `docs/FRONTEND_ARCHITECTURE.md` | Frontend stack, komponenter | UI-arkitektur endringer |
| `docs/SECURITY_ARCHITECTURE.md` | Sikkerhetsarkitektur | Sikkerhetsrelaterte endringer |
| `backend/STRUCTURE.md` | Backend mappestruktur | Backend-refaktorering |
| `backend/docs/API.md` | API-dokumentasjon (manuell) | Nye endpoints, eksempler |
| `backend/docs/openapi.yaml` | OpenAPI spec (generert) | Kjør generate_openapi.py |
| `QUICKSTART.md` | Kom i gang guide | API-endringer, setup-endringer |
| `THIRD-PARTY-NOTICES.md` | Tredjepartsavhengigheter | Nye/oppdaterte avhengigheter |

## Automatisk sjekk

### Kjør docs_drift.py

```bash
# Standard sjekk
python scripts/docs_drift.py

# Med alle detaljer
python scripts/docs_drift.py --verbose

# JSON output (for scripting)
python scripts/docs_drift.py --format json

# CI-modus (exit 1 ved kritisk drift)
python scripts/docs_drift.py --ci
```

### Hva scriptet sjekker

| Sjekk | Beskrivelse | Severity |
|-------|-------------|----------|
| **Avhengighetsversjoner** | package.json vs README/THIRD-PARTY-NOTICES | warning |
| **Mappestruktur** | Dokumenterte mapper vs faktisk struktur | critical/warning |
| **Event-typer** | ARCHITECTURE_AND_DATAMODEL vs events.py | info |
| **npm scripts** | CLAUDE.md vs package.json | warning |
| **Sist oppdatert** | Viser datoer i dokumenter | info |

### Tolke output

```
============================================================
  DOCUMENTATION DRIFT REPORT
============================================================

DEPENDENCY VERSIONS
----------------------------------------
  [ADVARSEL] React: dokumentert 18.2, faktisk 19.2.0
                    ↑ Oppdater README.md med ny versjon

FOLDER STRUCTURE
----------------------------------------
  [KRITISK] Dokumentert mappe mangler: src/utils
            ↑ Enten opprett mappen eller fjern fra dokumentasjon

EVENT TYPES
----------------------------------------
  [INFO] Event-type i kode men ikke dokumentert: ny_event_type
         ↑ Vurder å dokumentere i ARCHITECTURE_AND_DATAMODEL.md
```

## Manuell oppdatering

### Når oppdatere hva

| Endring | Dokumenter å oppdatere |
|---------|------------------------|
| Ny npm-pakke | README (Teknologier), THIRD-PARTY-NOTICES |
| Ny pip-pakke | README (Teknologier), THIRD-PARTY-NOTICES |
| Ny event-type | ARCHITECTURE_AND_DATAMODEL, README (Event-oversikt) |
| Ny API-endpoint | openapi.yaml (via generator), API.md, QUICKSTART |
| Ny mappe | README (Prosjektstruktur), CLAUDE.md |
| Ny skill | CLAUDE.md (Skills-seksjonen) |
| Sikkerhetsendring | SECURITY_ARCHITECTURE |
| Frontend-refaktorering | FRONTEND_ARCHITECTURE |
| Backend-refaktorering | backend/STRUCTURE.md |

### Sjekkliste før release

1. **Kjør automatisk sjekk:**
   ```bash
   python scripts/docs_drift.py
   ```

2. **Oppdater "Sist oppdatert"-datoer** i dokumenter som er endret

3. **Verifiser versjoner:**
   - Sjekk at README teknologiversjoner matcher package.json
   - Sjekk at THIRD-PARTY-NOTICES har korrekte versjoner

4. **Gjennomgå QUICKSTART:**
   - Er oppsettstegene fortsatt korrekte?
   - Er API-endpoints oppdatert?

5. **Verifiser arkitekturdokumentasjon:**
   - Reflekterer diagrammer faktisk arkitektur?
   - Er alle event-typer dokumentert?

6. **Regenerer API-dokumentasjon:**
   ```bash
   cd backend && python scripts/generate_openapi.py
   ```
   - Sjekk at openapi.yaml er oppdatert
   - Verifiser at API.md har eksempler for nye endpoints

## Beste praksis

### Dokumentasjonsstil

- **Bruk norsk** for brukerrettet dokumentasjon
- **Bruk engelsk** for tekniske termer (event types, API endpoints)
- **Inkluder dato** "Sist oppdatert: YYYY-MM-DD" øverst i dokumenter
- **Hold diagrammer oppdatert** - ASCII-diagrammer i markdown

### Når dokumentere

- **Under utvikling:** Hold CLAUDE.md oppdatert kontinuerlig
- **Ved ferdigstillelse:** Oppdater relevante docs/ filer
- **Før merge:** Kjør `python scripts/docs_drift.py`
- **Ved release:** Full dokumentasjonsgjennomgang

### Unngå

- Duplisering av informasjon mellom dokumenter
- Utdaterte kodeeksempler
- Hardkodede versjoner som ikke vedlikeholdes
- Dokumentasjon av features som ikke er implementert

## Integrasjon med andre verktøy

### Sammen med static-analysis

```bash
# Komplett sjekk før commit
python scripts/check_drift.py      # Kode-synk
python scripts/docs_drift.py       # Dokumentasjon-synk
npm run lint                       # Kode-kvalitet
```

### CI/CD

```yaml
# GitHub Actions eksempel
- name: Documentation Check
  run: python scripts/docs_drift.py --ci
```

## Vanlige oppgaver

### Oppdatere versjoner etter npm update

1. Kjør `npm update`
2. Kjør `python scripts/docs_drift.py`
3. Oppdater README.md teknologitabell
4. Oppdater THIRD-PARTY-NOTICES.md

### Legge til ny event-type

1. Definer event i `backend/models/events.py`
2. Dokumenter i `docs/ARCHITECTURE_AND_DATAMODEL.md`:
   - Legg til i event-tabellen
   - Beskriv når event brukes
3. Kjør `python scripts/docs_drift.py --verbose` for å verifisere

### Ny mappe i prosjektstruktur

1. Opprett mappen
2. Oppdater README.md prosjektstruktur-diagram
3. Oppdater CLAUDE.md hvis relevant for Claude Code kontekst

## API-dokumentasjon

Backend API-dokumentasjon følger et to-lags system:

| Fil | Type | Formål |
|-----|------|--------|
| `backend/docs/openapi.yaml` | Generert | Maskinlesbar OpenAPI 3.0 spec |
| `backend/docs/API.md` | Manuell | Menneskevennlig med eksempler |

### OpenAPI-generatoren

`backend/scripts/generate_openapi.py` genererer `openapi.yaml` fra Pydantic-modeller.

```bash
# Generer OpenAPI spec
cd backend && python scripts/generate_openapi.py

# Eller med eksplisitt output
python scripts/generate_openapi.py --output docs/openapi.yaml
```

### Workflow for nye API-endpoints

1. **Implementer endpoint** i `backend/routes/*.py`
2. **Oppdater generatoren** - Legg til path i `generate_paths()` i `generate_openapi.py`
3. **Regenerer spec:**
   ```bash
   cd backend && python scripts/generate_openapi.py
   ```
4. **Oppdater API.md** - Legg til menneskevennlig dokumentasjon med eksempler
5. **Oppdater QUICKSTART.md** hvis endpointet er viktig for oppstart

### Hva generatoren håndterer

- **Schemas** fra Pydantic-modeller (automatisk)
- **Paths** må legges til manuelt i `generate_paths()`
- **Security schemes** (CSRF, Magic Link)
- **Request/Response eksempler**

### Synkronisering

OpenAPI-generatoren er **source of truth** for API-struktur:

```
Pydantic models → generate_openapi.py → openapi.yaml
                                              ↓
                                    API.md (manuell sync)
```

Ved drift mellom openapi.yaml og faktiske routes:
1. Sjekk at `generate_paths()` inkluderer alle routes
2. Kjør generatoren på nytt
3. Oppdater API.md hvis nødvendig
