# Skjema Endringsmeldinger

**Digital samhandlingsplattform for strukturerte endringsmeldinger i byggeprosjekter**

Et system for håndtering av endringsordrer (KOE) etter NS 8407:2011, integrert med prosjekthotellet Catenda. Utviklet av Oslobygg KF for å erstatte manuelle PDF/Word-baserte prosesser med strukturerte, sporbare data.

**Sist oppdatert:** 2025-12-01

---

## Innhold

- [Om prosjektet](#om-prosjektet)
- [Arbeidsflyt](#arbeidsflyt)
- [Arkitektur](#arkitektur)
- [Teknologier](#teknologier)
- [Kom i gang](#kom-i-gang)
- [Prosjektstruktur](#prosjektstruktur)
- [Gjenbrukbarhet](#gjenbrukbarhet)
- [Dokumentasjon](#dokumentasjon)
- [Testing](#testing)
- [Status](#status)
- [Lisens](#lisens)

---

## Om prosjektet

### Problemstilling

Endringsmeldinger i byggeprosjekter håndteres tradisjonelt via PDF/Word-skjemaer som sendes mellom parter. Dette medfører:

- **Datatap** – Informasjon innelåst i PDF-format, ikke søkbar eller analyserbar
- **Ineffektivitet** – Manuell filhåndtering, dobbeltregistrering, lang behandlingstid
- **Manglende sporbarhet** – Vanskelig å følge historikk og presedens
- **Fristrisiko** – Ingen automatiske varsler for kontraktsfestede frister

### Løsning

Denne plattformen digitaliserer prosessen ved å:

- **Strukturere data** – Alle felt lagres i database, ikke innelåst i dokumenter
- **Integrere med Catenda** – Saker opprettes i prosjekthotellet, lenker til skjema
- **Automatisere arkivering** – PDF genereres og lastes opp til Catenda automatisk
- **Sikre sporbarhet** – Komplett audit trail for alle handlinger

---

## Arbeidsflyt

Prosessen følger NS 8407:2011 for håndtering av krav om endring (KOE):

### Oversikt

```
FASE 1.1          FASE 1.2          FASE 2            FASE 3            FASE 4
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ VARSLING │────▶│ LAGRING  │────▶│  KRAV    │────▶│  SVAR    │────▶│   EO     │
│          │     │          │     │  (KOE)   │     │  (BH)    │     │          │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘     └──────────┘
                                        ▲               │
                                        │               │ Delvis/Avvist
                                        └───────────────┘ (revisjon)
```

### FASE 1.1: VARSLING

```
┌─────────────────┐
│  ENTREPRENØR    │  1. Oppretter sak i Catenda (varsel om endring)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LØSNINGEN      │  2. Oppdager saken automatisk via webhook
│                 │  3. Legger sikker lenke (magic link) i kommentarfeltet
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ENTREPRENØR    │  4. Fyller ut digitalt varselskjema
│                 │  5. Sender formelt varsel → PDF genereres
└─────────────────┘
```

### FASE 1.2: OPPDATERING I DATABASE OG CATENDA

```
┌─────────────────┐
│  LØSNINGEN      │  1. Sender data til database (CSV i prototype, Dataverse i prod)
│                 │  2. Laster automatisk opp PDF til saken i Catenda
│                 │  3. Legger ny lenke i kommentarfeltet for neste steg
└─────────────────┘
```

### FASE 2: INNSENDING AV KRAV (KOE)

```
┌─────────────────┐
│  ENTREPRENØR    │  1. Klikker på lenken fra Fase 1.2
│                 │  2. Fyller ut kravskjema (vederlag, fristforlengelse)
│                 │  3. Sender kravet → PDF genereres
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LØSNINGEN      │  Fase 1.2 gjentas med oppdaterte data
└─────────────────┘
```

### FASE 3: BYGGHERRENS SVAR

```
┌─────────────────┐
│  BYGGHERRE/PL   │  1. Åpner lenken for å svare på kravet
│                 │  2. Vurderer kravet
└────────┬────────┘
         │
         ├──────────────────────────────────────────┐
         │                                          │
         ▼                                          ▼
┌─────────────────┐                      ┌─────────────────┐
│  GODKJENT       │                      │  DELVIS GODKJENT│
│                 │                      │  ELLER AVVIST   │
│  → Gå til       │                      │                 │
│    FASE 4       │                      │  → Entreprenør  │
│                 │                      │    kan sende    │
│                 │                      │    revidert     │
│                 │                      │    krav (FASE 2)│
└─────────────────┘                      └─────────────────┘
```

### FASE 4: ENDRINGSORDRE (EO)

```
┌─────────────────┐
│  EO UTSTEDES    │  KOE-sak avsluttes. Endringsordre utstedes.
│                 │
│  (Ikke impl.    │
│   i prototype)  │
└─────────────────┘
```

**Merk:** Databaselagring til Dataverse og skjema for EO (endringsordre) er planlagt for produksjon, ikke implementert i prototypen.

---

## Arkitektur

### Prototype (nåværende)

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                   React 19 + TypeScript                         │
│              Oslo kommunes designsystem (Punkt)                 │
│                      Vite dev server                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│              Flask 3 + Python (app.py: 155 linjer)              │
│                  Pydantic v2 validering                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   HTTP Layer         Service Layer         Data Layer           │
│  ┌──────────┐       ┌──────────┐         ┌──────────┐          │
│  │ routes/  │ ────▶ │services/ │ ───────▶│repos/    │          │
│  │ 7 filer  │       │ 5 filer  │         │CSVRepo   │          │
│  └──────────┘       └──────────┘         └──────────┘          │
│                                                 │               │
└─────────────────────────────────────────────────┼───────────────┘
                            │ Catenda API         │
                            ▼                     ▼
┌─────────────────────────────────────────┐  ┌──────────┐
│                CATENDA                   │  │ koe_data/│
│     Prosjekthotell (ekstern tjeneste)   │  │ (JSON)   │
│   Topics, Comments, Documents, Webhooks │  └──────────┘
└─────────────────────────────────────────┘
```

### Produksjon (planlagt)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Azure SWA      │────▶│ Azure Functions │────▶│   Dataverse     │
│  (Frontend)     │     │   (Backend)     │     │   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   Catenda API   │
                        └─────────────────┘
```

**Backend-arkitektur:** Se [backend/STRUCTURE.md](backend/STRUCTURE.md) for detaljert beskrivelse av den refaktorerte, lagdelte arkitekturen.

---

## Teknologier

### Frontend

| Teknologi | Versjon | Formål |
|-----------|---------|--------|
| React | 19.2 | UI-rammeverk |
| TypeScript | 5.8 | Typesikkerhet |
| Vite | 6.2 | Bygg og utviklingsserver |
| Vitest | 4.0 | Testing |
| Tailwind CSS | 4.1 | Styling |
| @oslokommune/punkt-react | 13.15 | Oslo kommunes designsystem |
| @react-pdf/renderer | 4.3 | PDF-generering |

### Backend

| Teknologi | Versjon | Formål |
|-----------|---------|--------|
| Python | 3.8+ | Språk |
| Flask | 3.0 | Web-rammeverk |
| Pydantic | 2.0+ | Datavalidering og modeller |
| pydantic-settings | 2.0+ | Miljøvariabel-håndtering |
| Flask-CORS | 4.0 | CORS-håndtering |
| Flask-Limiter | 3.5 | Rate limiting |
| requests | 2.31 | HTTP-klient |

---

## Kom i gang

### Forutsetninger

- **Node.js** 18+ og npm
- **Python** 3.8+
- **Git**

### 1. Klon repositoriet

```bash
git clone <repository-url>
cd Skjema_Endringsmeldinger
```

### 2. Sett opp backend

```bash
cd backend

# Opprett virtuelt miljø
python -m venv venv
source venv/bin/activate  # På Windows: venv\Scripts\activate

# Installer avhengigheter
pip install -r requirements.txt

# Kopier og konfigurer miljøvariabler
cp .env.example .env
# Rediger .env med dine verdier

# Start backend
python app.py
```

Backend kjører på `http://localhost:8080`

### 3. Sett opp frontend

```bash
# I rot-mappen
npm install

# Kopier og konfigurer miljøvariabler
cp .env.example .env.local

# Start utviklingsserver
npm run dev
```

Frontend kjører på `http://localhost:3000`

### 4. Åpne applikasjonen

Gå til `http://localhost:3000/Skjema_Endringsmeldinger/` i nettleseren.

Se [GETTING_STARTED.md](docs/GETTING_STARTED.md) for detaljert oppsettguide inkludert Catenda-konfigurasjon.

---

## Prosjektstruktur

```
Skjema_Endringsmeldinger/
│
├── App.tsx                         # Hovedkomponent (344 linjer)
├── index.tsx                       # Entry point
├── types.ts                        # TypeScript-definisjoner (interfaces, statustyper)
│
├── config/                         # Konfigurasjon og standardverdier
│   ├── formDefaults.ts             # Standard skjemaverdier
│   ├── dropdownOptions.ts          # Dropdown-alternativer
│   ├── demoData.ts                 # Demo-/testdata
│   ├── tabs.ts                     # Fane-konfigurasjon
│   └── fileUpload.ts               # Filopplasting-innstillinger
│
├── components/
│   ├── layout/                     # Layout-komponenter
│   │   ├── AppLayout.tsx           # Hovedlayout wrapper
│   │   ├── AppHeader.tsx           # Header med logo
│   │   ├── TabNavigation.tsx       # Fane-navigasjon
│   │   └── BottomBar.tsx           # Bunnseksjon
│   ├── panels/                     # Hovedpaneler
│   │   ├── VarselPanel.tsx         # Varsel-skjema
│   │   ├── KravKoePanel.tsx        # KOE-skjema
│   │   ├── BhSvarPanel.tsx         # Byggherre-svar
│   │   └── TestOversiktPanel.tsx   # Saksoversikt
│   └── ui/                         # Gjenbrukbare UI-komponenter
│
├── hooks/                          # Custom React hooks (10 stk)
│   ├── useApiConnection.ts
│   ├── useCaseLoader.ts
│   ├── useFormSubmission.ts
│   └── ...
│
├── services/                       # Frontend-tjenester
│   ├── validationService.ts
│   └── submissionService.ts
│
├── utils/                          # Hjelpefunksjoner
│   └── pdf/                        # PDF-generering
│
├── backend/                        # Backend (Python/Flask)
│   ├── app.py                      # Flask entrypoint (155 linjer)
│   ├── core/                       # Sentralisert konfigurasjon
│   │   ├── config.py               # Pydantic BaseSettings
│   │   └── system_context.py       # SystemContext
│   ├── routes/                     # Flask blueprints (7 filer)
│   ├── services/                   # Forretningslogikk (5 filer)
│   ├── repositories/               # Dataaksess (CSV, fremtidig Dataverse)
│   ├── models/                     # Pydantic-modeller (4 filer)
│   ├── integrations/catenda/       # Catenda API-klient
│   ├── lib/                        # Auth, security, monitoring
│   ├── functions/                  # Azure Functions adapter
│   └── tests/                      # Testsuite (379 tester)
│
├── docs/                           # Dokumentasjon
│
├── shared/                         # Delt konfigurasjon
│   └── status-codes.json           # Statuskoder (frontend + backend)
│
└── public/                         # Statiske assets
    └── logos/
```

Se [backend/STRUCTURE.md](backend/STRUCTURE.md) for detaljert backend-arkitektur med linjetall.

---

## Gjenbrukbarhet

Backend-arkitekturen er designet for gjenbruk på tvers av skjematyper. Den lagdelte strukturen (Routes → Services → Repositories) gjør det enkelt å:

### Legge til nye skjematyper

1. **Definer modell** i `models/` med Pydantic
2. **Opprett service** i `services/` for forretningslogikk
3. **Legg til routes** i `routes/` for HTTP-endepunkter
4. **Gjenbruk** eksisterende Catenda-integrasjon og sikkerhetsmønstre

### Potensielle anvendelser

| Skjematype | Beskrivelse |
|------------|-------------|
| Fravikssøknader | Entreprenør søker dispensasjon fra kontraktskrav |
| HMS-rapportering | Ukentlige sikkerhetsrapporter |
| Kvalitetskontroll | Inspeksjonsrapporter med sjekklister |
| Avviksbehandling | Registrering og oppfølging av avvik |

### Delte komponenter

- **Catenda-integrasjon** – Webhook-mottak, kommentarer, dokumentopplasting
- **Sikkerhetsmønstre** – CSRF, magic links, validering, audit logging
- **PDF-generering** – Tilpassbare maler med Oslo kommunes design
- **Statuskoder** – Sentralisert i `shared/status-codes.json`

---

## Dokumentasjon

| Dokument | Beskrivelse |
|----------|-------------|
| [HLD - Overordnet Design](docs/HLD%20-%20Overordnet%20Design.md) | Arkitektur, datamodell, integrasjoner |
| [GETTING_STARTED.md](docs/GETTING_STARTED.md) | Detaljert oppsettguide |
| [API.md](docs/API.md) | Backend API-referanse |
| [FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md) | Frontend-arkitektur og komponenter |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Azure-utrulling |
| [backend/STRUCTURE.md](backend/STRUCTURE.md) | Backend-mappestruktur (detaljert) |
| [Refaktoreringsplan - Backend](docs/Refaktoreringsplan%20-%20Backend.md) | Backend-refaktorering |
| [PRE_PRODUCTION_PLAN.md](docs/PRE_PRODUCTION_PLAN.md) | Pre-produksjon sjekkliste |
| [Handlingsplan Sikkerhetstiltak](docs/Handlingsplan_Sikkerhetstiltak.md) | Sikkerhetsimplementering |

---

## Testing

### Backend (379 tester, 62% coverage)

```bash
cd backend

# Kjør alle tester
python -m pytest tests/ -v

# Kjør med coverage
python -m pytest tests/ --cov=. --cov-report=html

# Manuell API-testing
./scripts/manual_testing.sh
```

**Testdekning:**

| Kategori | Tester | Coverage |
|----------|--------|----------|
| Services | 5 filer | 83-93% |
| Routes | 3 filer | 91-100% |
| Security | 4 filer | 79-95% |
| Models | 1 fil | 100% |
| Utils | 3 filer | 100% |

### Frontend (95 tester)

```bash
# Kjør alle tester
npm test

# Kjør med UI
npm run test:ui

# Kjør med coverage
npm run test:coverage
```

---

## Scripts

### Frontend

| Kommando | Beskrivelse |
|----------|-------------|
| `npm run dev` | Start utviklingsserver |
| `npm run build` | Bygg for produksjon |
| `npm run preview` | Forhåndsvis produksjonsbygg |
| `npm test` | Kjør tester |
| `npm run generate:constants` | Generer statuskoder fra JSON |

### Backend

| Kommando | Beskrivelse |
|----------|-------------|
| `python app.py` | Start Flask-server |
| `python -m pytest tests/ -v` | Kjør tester |
| `python scripts/catenda_menu.py` | Interaktiv Catenda API-meny |
| `python scripts/setup_webhooks.py` | Konfigurer Catenda webhooks |

---

## Status

**Prototype-status:** Klar for produksjonsmigrering (kode)

### Implementert

- ✅ Frontend med alle paneler (Varsel, KOE, BH Svar, Oppsummering)
- ✅ Backend med lagdelt arkitektur (app.py: 1231 → 155 linjer)
- ✅ Catenda-integrasjon (API-klient, webhooks, magic links)
- ✅ PDF-generering og automatisk opplasting
- ✅ Sikkerhetstiltak (CSRF, validering, rate limiting, audit logging)
- ✅ Comprehensive testing (379 backend + 95 frontend tester)

### Gjenstår for produksjon

- ⏳ Azure Landing Zone (infrastruktur)
- ⏳ DataverseRepository (erstatte CSV)
- ⏳ Azure Functions-migrering
- ⏳ Redis for state (rate limiting, idempotency)
- ⏳ EO-skjema (endringsordre)

Se [PRE_PRODUCTION_PLAN.md](docs/PRE_PRODUCTION_PLAN.md) for detaljert sjekkliste.

---

## Bidrag

Prosjektet er utviklet av Oslobygg KF. For spørsmål eller bidrag, kontakt prosjektteamet.

---

## Lisens

Dette prosjektet er lisensiert under MIT-lisensen - se [LICENSE](LICENSE)-filen for detaljer.

### Tredjeparts-avhengigheter

Prosjektet bruker flere tredjeparts-biblioteker, inkludert:

- **Oslo Kommune Punkt Design System** (@oslokommune/punkt-*) - MIT License
- **React** - MIT License
- **Vite** - MIT License
- Og flere andre (se [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for fullstendig liste)

Alle avhengigheter er kompatible med MIT-lisensen.
