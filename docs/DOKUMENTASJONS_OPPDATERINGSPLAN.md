# Plan for Kvalitetssikring og Oppdatering av Dokumentasjon

**Dato:** 2025-12-01
**Versjon:** 1.0
**Status:** Planlagt

---

## Innhold

1. [Executive Summary](#1-executive-summary)
2. [Analyse: Nåværende tilstand](#2-analyse-nåværende-tilstand)
3. [Prioritert rekkefølge](#3-prioritert-rekkefølge)
4. [Detaljert oppdateringsplan per dokument](#4-detaljert-oppdateringsplan-per-dokument)
5. [Kvalitetssikringsprosess](#5-kvalitetssikringsprosess)
6. [Sjekkliste](#6-sjekkliste)

---

## 1. Executive Summary

### Bakgrunn

Backend-refaktoreringen er **100% komplett** (2025-12-01). Dokumentasjonen må nå oppdateres for å reflektere:

- **Backend:** `app.py` redusert fra 1231 → 155 linjer
- **Frontend:** `App.tsx` redusert fra 528 → 344 linjer
- **Ny arkitektur:** Modulær struktur med services, repositories, routes
- **Arbeidsflyt:** Mer detaljert prosessflyt inkludert revisjoner

### Dokumenter som skal oppdateres

| # | Dokument | Prioritet | Avvik fra virkelighet |
|---|----------|-----------|----------------------|
| 1 | backend/STRUCTURE.md | 🔴 Kritisk | Betydelig utdatert |
| 2 | README.md | 🔴 Kritisk | Arbeidsflyt forenklet |
| 3 | FRONTEND_ARCHITECTURE.md | 🟠 Høy | App.tsx linjetall feil, mangler nye hooks |
| 4 | API.md | 🟠 Høy | Mangler nye endepunkter |
| 5 | Handlingsplan_Sikkerhetstiltak.md | 🟡 Medium | Status ikke oppdatert |
| 6 | GETTING_STARTED.md | 🟢 Lav | Små justeringer |
| 7 | DEPLOYMENT.md | 🟢 Lav | Ser oppdatert ut |

---

## 2. Analyse: Nåværende tilstand

### 2.1 Faktisk prosjektstruktur (verifisert)

```
Skjema_Endringsmeldinger/
│
├── App.tsx                      # 344 linjer (redusert fra 528)
├── index.tsx                    # Entry point
├── types.ts                     # TypeScript-definisjoner
│
├── components/
│   ├── layout/                  # NY mappe! AppLayout, AppHeader, TabNavigation, etc.
│   ├── panels/                  # Varsel, KOE, Svar, etc.
│   └── ui/                      # Gjenbrukbare komponenter
│
├── hooks/                       # 10 hooks (ikke 8)
│   ├── useApiConnection.ts
│   ├── useAutoSave.ts
│   ├── useCaseLoader.ts
│   ├── useEmailValidation.ts
│   ├── useFileUpload.ts
│   ├── useFormSubmission.ts
│   ├── useHandleInputChange.ts  # IKKE dokumentert
│   ├── useModal.ts              # NY hook!
│   ├── useSkjemaData.ts
│   └── useUrlParams.ts
│
├── backend/
│   ├── app.py                   # 155 linjer (redusert fra 1231)
│   │
│   ├── core/                    # NY mappe! Sentralisert konfigurasjon
│   │   ├── config.py            # Pydantic BaseSettings
│   │   ├── constants.py
│   │   ├── generated_constants.py
│   │   ├── cors_config.py       # NY fil
│   │   ├── logging_config.py    # NY fil
│   │   └── system_context.py    # NY fil (erstatter KOEAutomationSystem)
│   │
│   ├── routes/                  # 7 blueprint-filer
│   │   ├── varsel_routes.py
│   │   ├── koe_routes.py
│   │   ├── svar_routes.py
│   │   ├── case_routes.py
│   │   ├── webhook_routes.py
│   │   ├── utility_routes.py
│   │   └── error_handlers.py    # NY fil
│   │
│   ├── services/                # 5 service-filer
│   │   ├── varsel_service.py    # 216 linjer
│   │   ├── koe_service.py       # 312 linjer
│   │   ├── svar_service.py      # 334 linjer
│   │   ├── catenda_service.py   # 268 linjer
│   │   └── webhook_service.py   # NY! 169 linjer
│   │
│   ├── repositories/            # Repository pattern
│   │   ├── base_repository.py   # 111 linjer, 7 metoder
│   │   └── csv_repository.py    # Prototype-implementasjon
│   │
│   ├── models/                  # Pydantic v2 modeller
│   │   ├── varsel.py
│   │   ├── koe_revisjon.py
│   │   ├── bh_svar.py
│   │   └── sak.py               # NY modell
│   │
│   ├── lib/                     # Sikkerhet og auth
│   │   ├── auth/
│   │   │   ├── csrf_protection.py
│   │   │   └── magic_link.py
│   │   ├── security/
│   │   │   ├── validation.py
│   │   │   ├── webhook_security.py
│   │   │   └── rate_limiter.py  # NY fil
│   │   └── monitoring/
│   │       └── audit.py
│   │
│   ├── integrations/catenda/    # Catenda API-klient
│   │   ├── client.py
│   │   └── auth.py
│   │
│   ├── functions/               # Azure Functions adapter
│   │   └── adapters.py
│   │
│   └── utils/
│       ├── logger.py
│       ├── filtering_config.py
│       └── network.py           # NY fil
│
└── docs/                        # Dokumentasjon
```

### 2.2 Faktisk arbeidsflyt (fra bruker)

Den komplette arbeidsflyten som bør dokumenteres:

**FASE 1.1: VARSLING**
1. **Entreprenør** oppretter sak i Catenda (varsel om endring)
2. **Løsningen** oppdager saken automatisk via webhook
3. **Løsningen** legger sikker lenke i kommentarfeltet i Catenda
4. **Entreprenør** fyller ut digitalt skjema, sender formelt varsel. PDF genereres.

**FASE 1.2: OPPDATERING I DATABASE OG CATENDA**
1. **Løsningen** sender data til database (Dataverse i produksjon)
2. **Løsningen** laster automatisk opp PDF til Catenda
3. **Løsningen** legger ny lenke i kommentarfeltet

**FASE 2: INNSENDING AV KRAV**
1. **Entreprenør** klikker på lenken
2. **Entreprenør** fyller ut kravet (KOE)
3. **Løsningen** genererer ny PDF
4. Fase 1.2 gjentas med oppdaterte data

**FASE 3: BYGGHERRENS SVAR**
1. **Byggherre/PL** åpner lenken for å svare
2. **Byggherre/PL** vurderer kravet:
   - *HVIS "Delvis godkjent / Avvist":* Entreprenør får beskjed om å sende revidert krav (tilbake til FASE 2)
   - *HVIS "Godkjent":* Gå til FASE 4

**FASE 4: ENDRINGSORDRE**
- KOE-sak avsluttes
- EO utstedes *(ikke implementert i prototype)*

### 2.3 Test-status (verifisert)

- **Backend:** 379 tester, 100% pass rate, 62% coverage
- **Frontend:** 95 tester passerer

---

## 3. Prioritert rekkefølge

### Oppdateringsrekkefølge

| Trinn | Dokument | Begrunnelse |
|-------|----------|-------------|
| **1** | backend/STRUCTURE.md | Grunnlag for å forstå backend-arkitekturen |
| **2** | README.md | Hovedinngang - må reflektere ny arkitektur og arbeidsflyt |
| **3** | FRONTEND_ARCHITECTURE.md | Avhenger av README for konsistens |
| **4** | API.md | Må matche faktiske routes i backend |
| **5** | Handlingsplan_Sikkerhetstiltak.md | Oppdatere status for implementerte tiltak |
| **6** | GETTING_STARTED.md | Mindre justeringer |
| **7** | DEPLOYMENT.md | Verifisering |

### Avhengigheter

```
backend/STRUCTURE.md
        │
        ▼
     README.md ───────────────────┐
        │                         │
        ├───────────────┐         │
        ▼               ▼         ▼
FRONTEND_ARCHITECTURE  API.md   GETTING_STARTED.md
        │               │
        └───────────────┤
                        ▼
        Handlingsplan_Sikkerhetstiltak.md
                        │
                        ▼
                  DEPLOYMENT.md
```

---

## 4. Detaljert oppdateringsplan per dokument

### 4.1 backend/STRUCTURE.md

**Prioritet:** 🔴 Kritisk
**Estimert tid:** 1-2 timer

#### Endringer som kreves:

| Seksjon | Endring |
|---------|---------|
| Mappestruktur | Komplett omskriving - legg til `core/`, oppdater alle mapper |
| `constants.py` | Marker som deprecated, referer til `core/generated_constants.py` |
| core/ | NY seksjon: Beskriv config.py, system_context.py, cors_config.py, logging_config.py |
| services/ | Legg til `webhook_service.py` |
| lib/ | Legg til `rate_limiter.py` |
| utils/ | Legg til `network.py` |
| models/ | Legg til `sak.py` |
| routes/ | Legg til `error_handlers.py` |
| functions/ | Beskriv Azure Functions adapter |

#### Foreslått ny struktur:

```markdown
## 📁 Directory Organization

```
backend/
├── app.py                       # Flask entrypoint (155 linjer, minimal)
│
├── core/                        # Sentralisert konfigurasjon
│   ├── config.py               # Pydantic BaseSettings
│   ├── constants.py            # Statiske konstanter
│   ├── generated_constants.py  # Auto-generert fra shared/status-codes.json
│   ├── cors_config.py          # CORS-konfigurasjon
│   ├── logging_config.py       # Sentralisert logging setup
│   └── system_context.py       # SystemContext (erstatter KOEAutomationSystem)
│
├── routes/                      # Flask blueprints
│   ├── varsel_routes.py
│   ├── koe_routes.py
│   ├── svar_routes.py
│   ├── case_routes.py
│   ├── webhook_routes.py
│   ├── utility_routes.py
│   └── error_handlers.py       # Globale feilhåndterere
│
├── services/                    # Forretningslogikk (framework-agnostisk)
│   ├── varsel_service.py
│   ├── koe_service.py
│   ├── svar_service.py
│   ├── catenda_service.py
│   └── webhook_service.py      # Ny: Håndterer Catenda webhooks
│
...
```
```

---

### 4.2 README.md

**Prioritet:** 🔴 Kritisk
**Estimert tid:** 2-3 timer

#### Endringer som kreves:

| Seksjon | Endring |
|---------|---------|
| Arbeidsflyt | **Fullstendig omskriving** - inkluder alle 4 faser med revideringsløkke |
| Arkitektur (Prototype) | Oppdater diagram - referer til ny modulær struktur |
| Prosjektstruktur | Oppdater - legg til `core/`, `functions/`, `components/layout/` |
| Status | Oppdater sjekkbokser basert på faktisk status |
| Teknologier | Verifiser versjoner |

#### Foreslått ny arbeidsflyt-seksjon:

```markdown
### Arbeidsflyt

Prosessen følger NS 8407:2011 for håndtering av endringsordrer:

#### FASE 1: VARSLING

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ ENTREPRENØR     │────▶│ LØSNINGEN       │────▶│ CATENDA         │
│ Oppretter sak   │     │ Oppdager via    │     │ Kommentar med   │
│ i Catenda       │     │ webhook         │     │ magic link      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────┐
│ ENTREPRENØR     │────▶│ LØSNINGEN       │
│ Fyller ut       │     │ Genererer PDF   │
│ varselskjema    │     │ → Catenda       │
└─────────────────┘     └─────────────────┘
```

#### FASE 2: INNSENDING AV KRAV (KOE)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ ENTREPRENØR     │────▶│ LØSNINGEN       │────▶│ CATENDA         │
│ Fyller ut krav  │     │ Genererer PDF   │     │ PDF lastet opp  │
│ (vederlag/frist)│     │ → Database      │     │ + ny lenke      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

#### FASE 3: BYGGHERRENS SVAR

```
┌─────────────────┐     ┌─────────────────┐
│ BYGGHERRE/PL    │────▶│ VURDERING       │
│ Åpner lenken    │     │                 │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           ┌─────────────────┐       ┌─────────────────┐
           │ GODKJENT        │       │ DELVIS/AVVIST   │
           │ → FASE 4        │       │ → FASE 2        │
           │                 │       │ (revisjon)      │
           └─────────────────┘       └─────────────────┘
```

#### FASE 4: ENDRINGSORDRE

```
┌─────────────────┐
│ EO UTSTEDES     │
│ Sak avsluttes   │
│ (ikke impl.)    │
└─────────────────┘
```

**Merk:** Databaselagring til Dataverse og skjema for EO er planlagt for produksjon, ikke implementert i prototype.
```

---

### 4.3 FRONTEND_ARCHITECTURE.md

**Prioritet:** 🟠 Høy
**Estimert tid:** 1.5-2 timer

#### Endringer som kreves:

| Seksjon | Endring |
|---------|---------|
| Mappestruktur | Oppdater App.tsx linjetall (642 → 344), legg til `components/layout/` |
| Custom Hooks | Legg til `useHandleInputChange`, `useModal` (10 hooks totalt) |
| Komponenthierarki | Oppdater med layout-komponenter |
| State Management | Verifiser at beskrivelsen matcher faktisk implementasjon |

#### Spesifikke endringer:

```markdown
## Mappestruktur

```
/
├── App.tsx                     # Hovedkomponent (344 linjer, refaktorert)
...
├── components/
│   ├── layout/                 # NY: Layout-komponenter
│   │   ├── AppLayout.tsx       # Hovedlayout wrapper
│   │   ├── AppHeader.tsx       # Header med logo
│   │   ├── TabNavigation.tsx   # Fane-navigasjon
│   │   ├── BottomBar.tsx       # Bunnseksjon
│   │   └── InfoBanner.tsx      # Informasjonsbanner
│   │
│   ├── panels/                 # Hovedpaneler
...

## Custom Hooks

### Alle hooks (10 stk):

| Hook | Fil | Beskrivelse |
|------|-----|-------------|
| useApiConnection | useApiConnection.ts | API-tilkoblingsstatus |
| useAutoSave | useAutoSave.ts | Auto-lagring til localStorage |
| useCaseLoader | useCaseLoader.ts | Laste sak fra API |
| useEmailValidation | useEmailValidation.ts | E-postvalidering |
| useFileUpload | useFileUpload.ts | Filopplastingslogikk |
| useFormSubmission | useFormSubmission.ts | Håndtere innsending |
| useHandleInputChange | useHandleInputChange.ts | Input-håndtering helper |
| useModal | useModal.ts | Modal state management |
| useSkjemaData | useSkjemaData.ts | Form data state |
| useUrlParams | useUrlParams.ts | URL-parameter parsing |
```

---

### 4.4 API.md

**Prioritet:** 🟠 Høy
**Estimert tid:** 1.5-2 timer

#### Verifisering nødvendig:

1. Sammenlign dokumenterte endepunkter med faktiske routes
2. Sjekk at request/response-eksempler matcher implementasjon
3. Verifiser at alle nye endepunkter er dokumentert

#### Endringer som kreves:

| Seksjon | Endring |
|---------|---------|
| Webhooks | Oppdater til å bruke secret i URL path (ikke query param) |
| Feilhåndtering | Verifiser mot error_handlers.py |
| Eksempler | Oppdater med faktiske response-strukturer |

#### Spesifikk endring - Webhook URL:

```markdown
### Webhooks

#### `POST /webhook/catenda/{secret_path}`

**Path Parameters:**
| Parameter | Type | Beskrivelse |
|-----------|------|-------------|
| `secret_path` | string | Hemmelig path fra miljøvariabel `WEBHOOK_SECRET_PATH` |

**Merk:** Catenda fjerner query parameters fra webhook-URLer, derfor brukes secret i path.
```

---

### 4.5 Handlingsplan_Sikkerhetstiltak.md

**Prioritet:** 🟡 Medium
**Estimert tid:** 1 time

#### Endringer som kreves:

Oppdater status for alle tiltak basert på faktisk implementasjon:

| Tiltak | Dokumentert status | Faktisk status |
|--------|-------------------|----------------|
| CORS-restriksjon | Planlagt | ✅ Implementert i `core/cors_config.py` |
| CSRF-beskyttelse | Planlagt | ✅ Implementert, verifisert på alle muterende routes |
| Webhook Secret Token | Planlagt | ✅ Implementert med path-basert secret |
| Request validation | Planlagt | ✅ Implementert i `lib/security/validation.py` |
| Magic Link | Planlagt | ✅ Implementert i `lib/auth/magic_link.py` |
| Rate limiting | Planlagt | ✅ Implementert i `lib/security/rate_limiter.py` |
| Audit logging | Planlagt | ✅ Implementert i `lib/monitoring/audit.py` |
| Project-scope authorization | Planlagt | ⚠️ Delvis (krever Dataverse) |
| Entra ID SSO | Planlagt | ❌ Ikke startet |
| Role-based field locking | Planlagt | ⚠️ Delvis |

---

### 4.6 GETTING_STARTED.md

**Prioritet:** 🟢 Lav
**Estimert tid:** 30-45 minutter

#### Endringer som kreves:

| Seksjon | Endring |
|---------|---------|
| Forutsetninger | Verifiser versjoner |
| Backend-oppsett | Nevn `requirements-dev.txt` for testing |
| Feilsøking | Legg til nye vanlige feil |
| Nyttige kommandoer | Oppdater med nye test-kommandoer |

---

### 4.7 DEPLOYMENT.md

**Prioritet:** 🟢 Lav
**Estimert tid:** 30 minutter

#### Verifisering:

- Sammenlign Azure Functions struktur med faktisk `backend/functions/`
- Verifiser at alle miljøvariabler er dokumentert
- Sjekk at sjekklisten er oppdatert

---

## 5. Kvalitetssikringsprosess

### 5.1 For hvert dokument

1. **Les nåværende dokument**
2. **Verifiser mot kodebasen:**
   - Mappestruktur
   - Filnavn
   - Linjetall
   - Funksjonsnavn
3. **Identifiser avvik**
4. **Oppdater dokument**
5. **Verifiser konsistens** med andre dokumenter
6. **Test lenker** til andre filer

### 5.2 Konsistenssjekk

Etter alle oppdateringer, verifiser:

- [ ] Samme terminologi brukes på tvers av dokumenter
- [ ] Linjetall matcher faktisk kode
- [ ] Mappestrukturer er identiske i alle dokumenter
- [ ] Versjonstall er konsistente
- [ ] Lenker mellom dokumenter fungerer

### 5.3 Kodebase-verifisering

```bash
# Verifiser linjetall
wc -l App.tsx backend/app.py

# List alle hooks
ls hooks/

# List backend-struktur
find backend -type f -name "*.py" | grep -v __pycache__ | sort

# Sjekk testdekning
cd backend && python -m pytest tests/ --cov=. --cov-report=term-missing
```

---

## 6. Sjekkliste

### Før oppdatering starter

- [ ] Git branch opprettet: `docs/quality-assurance`
- [ ] Kodebase verifisert med bash-kommandoer
- [ ] Backup av eksisterende dokumenter

### Per dokument

**backend/STRUCTURE.md:**
- [ ] Mappestruktur komplett omskrevet
- [ ] Alle nye filer dokumentert
- [ ] Import-eksempler oppdatert

**README.md:**
- [ ] Arbeidsflyt fullstendig omskrevet med alle 4 faser
- [ ] Revideringsløkke dokumentert
- [ ] Arkitekturdiagram oppdatert
- [ ] Prosjektstruktur oppdatert
- [ ] Status-sjekkbokser oppdatert

**FRONTEND_ARCHITECTURE.md:**
- [ ] App.tsx linjetall korrigert (344)
- [ ] Alle 10 hooks dokumentert
- [ ] Layout-komponenter lagt til
- [ ] Mappestruktur oppdatert

**API.md:**
- [ ] Webhook-path dokumentert korrekt
- [ ] Alle endepunkter verifisert
- [ ] Response-eksempler oppdatert

**Handlingsplan_Sikkerhetstiltak.md:**
- [ ] Alle implementerte tiltak markert ✅
- [ ] Delvis implementerte markert ⚠️
- [ ] Ikke-startede markert ❌

**GETTING_STARTED.md:**
- [ ] Versjonsnumre verifisert
- [ ] Test-kommandoer oppdatert

**DEPLOYMENT.md:**
- [ ] Azure Functions struktur verifisert
- [ ] Miljøvariabler komplett
- [ ] Sjekkliste oppdatert

### Etter alle oppdateringer

- [ ] Konsistenssjekk fullført
- [ ] Alle lenker testet
- [ ] Git commit med beskrivende melding
- [ ] PR opprettet for review

---

## Vedlegg: Kommandoer for verifisering

```bash
# Sjekk faktisk filstruktur
find . -name "*.py" -o -name "*.tsx" | grep -v node_modules | grep -v __pycache__ | sort

# Sjekk linjetall for nøkkelfiler
wc -l App.tsx backend/app.py backend/services/*.py backend/routes/*.py

# List alle hooks
ls -la hooks/

# List backend core/
ls -la backend/core/

# List alle routes
ls -la backend/routes/

# List alle services
ls -la backend/services/

# Kjør tester og sjekk coverage
cd backend && python -m pytest tests/ --cov=. --cov-report=term-missing -q
```

---

**Vedlikeholdt av:** Claude
**Opprettet:** 2025-12-01
**Status:** Klar for gjennomføring
