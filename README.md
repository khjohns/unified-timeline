# Skjema Endringsmeldinger

**Digital samhandlingsplattform for strukturerte endringsmeldinger i byggeprosjekter**

Et system for håndtering av endringsordrer (KOE) etter NS 8407:2011, integrert med prosjekthotellet Catenda. Utviklet av Oslobygg KF for å erstatte manuelle PDF/Word-baserte prosesser med strukturerte, sporbare data.

**Sist oppdatert:** 2026-01-14

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

- **Event Sourcing** – Alle endringer lagres som uforanderlige hendelser, gir komplett historikk
- **Tre uavhengige spor** – Grunnlag, Vederlag og Frist behandles parallelt (NS 8407 Port-modell)
- **Integrere med Catenda** – Saker opprettes i prosjekthotellet, lenker til skjema
- **Automatisere arkivering** – PDF genereres og lastes opp til Catenda automatisk
- **Sikre sporbarhet** – Komplett audit trail via event log

---

## Arbeidsflyt

Prosessen følger NS 8407:2011 for håndtering av krav om endring (KOE), implementert med event sourcing og tre parallelle spor. Systemet støtter tre **sakstyper**: `standard` (KOE), `forsering` (§33.8) og `endringsordre` (§31.3).

### Oversikt

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STANDARD SAK (KOE)                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ GRUNNLAG (Ansvar)     VEDERLAG (Betaling)     FRIST (Tid)              ││
│  │ "Hvorfor?"            "Hva koster det?"       "Hvor lang tid?"         ││
│  │                                                                         ││
│  │ TE: grunnlag_         TE: vederlag_krav_      TE: frist_krav_          ││
│  │     opprettet             sendt                   sendt                 ││
│  │         │                    │                       │                  ││
│  │         ▼                    ▼                       ▼                  ││
│  │ BH: respons_          BH: respons_            BH: respons_             ││
│  │     grunnlag              vederlag                frist                ││
│  │     (Port 1)              (Port 1+2)              (Port 1+2+3)         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│           │                                              │                   │
│           │ Alle spor godkjent                          │ BH avslår frist   │
│           ▼                                              ▼                   │
│  ┌─────────────────┐                           ┌─────────────────┐          │
│  │ ENDRINGSORDRE   │                           │   FORSERING     │          │
│  │    (§31.3)      │                           │    (§33.8)      │          │
│  │ Samler KOE-saker│                           │ TE akselererer  │          │
│  └─────────────────┘                           └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sakstyper

| Sakstype | Beskrivelse | Når brukes |
|----------|-------------|------------|
| `standard` | Ordinær KOE-sak med tre-spor behandling | Alle krav om endring |
| `forsering` | Akselerasjonssak (§33.8) | Når BH avslår berettiget fristkrav |
| `endringsordre` | Formell EO fra BH (§31.3) | Når KOE-saker er ferdigbehandlet |

### Steg 1: Sak opprettes via Catenda

```
┌─────────────────┐
│  ENTREPRENØR    │  1. Oppretter topic i Catenda (varsel om endring)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LØSNINGEN      │  2. Mottar webhook fra Catenda
│                 │  3. Genererer magic link (gyldig 72 timer)
│                 │  4. Poster lenke som kommentar i Catenda-topic
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ENTREPRENØR    │  5. Klikker lenken og åpner KOE-skjema
│                 │  → Event: sak_opprettet
└─────────────────┘
```

### Steg 2: Grunnlag (Ansvarsgrunnlag)

Entreprenør dokumenterer årsaken til kravet.

```
┌─────────────────┐
│  ENTREPRENØR    │  Fyller ut grunnlagsskjema:
│  (TE)           │  • Hovedkategori (forsinkelse, endring, etc.)
│                 │  • Beskrivelse og kontraktsreferanser
│                 │  → Event: grunnlag_opprettet
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LØSNINGEN      │  • PDF genereres automatisk
│                 │  • Lastes opp til Catenda
│                 │  • Statuskommentar postes
└─────────────────┘
```

Magic link forblir gyldig, så TE kan umiddelbart fortsette til vederlag/frist.

### Steg 3: Vederlag og/eller Frist (parallelt)

Entreprenør kan sende krav om vederlag og/eller fristforlengelse:

```
┌─────────────────┐              ┌─────────────────┐
│  VEDERLAGSKRAV  │              │  FRISTKRAV      │
│                 │              │                 │
│  • Metode       │              │  • Varseltype   │
│  • Beløp        │              │  • Antall dager │
│  • Begrunnelse  │              │  • Begrunnelse  │
│                 │              │                 │
│  → vederlag_    │              │  → frist_krav_  │
│    krav_sendt   │              │    sendt        │
└─────────────────┘              └─────────────────┘
```

### Steg 4: Byggherrens respons

Byggherre vurderer hvert spor separat med Port-modellen:

```
GRUNNLAG                  VEDERLAG                   FRIST
────────────────────────────────────────────────────────────────
Port 1: Ansvar            Port 1: Varsling           Port 1: Varsling
• godkjent                • Varslet i tide?          • Varslet i tide?
• delvis_godkjent
• avvist                  Port 2: Beregning          Port 2: Vilkår
• erkjenn_fm              • godkjent                 • vilkar_oppfylt?
• frafalt                 • delvis_godkjent
• krever_avklaring        • avslatt                  Port 3: Utmåling
                          • avventer                 • godkjent
→ respons_grunnlag        • hold_tilbake             • delvis_godkjent
                                                     • avslatt
                          → respons_vederlag         • avventer

                                                     → respons_frist
```

Ved delvis godkjenning eller avvisning kan TE sende revidert krav:
- `grunnlag_oppdatert` / `vederlag_krav_oppdatert` / `frist_krav_oppdatert`

### Steg 5: Endringsordre (EO) eller Forsering

#### Alternativ A: Endringsordre (§31.3)

Når alle spor er godkjent (`kan_utstede_eo = true`), kan BH utstede en endringsordre:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENDRINGSORDRE (§31.3)                         │
├─────────────────────────────────────────────────────────────────┤
│  1. BH oppretter EO-sak (sakstype = "endringsordre")            │
│  2. Velger KOE-saker som skal inkluderes                        │
│  3. Angir konsekvenser (pris, frist, SHA, kvalitet)             │
│  4. Utsteder EO → TE kan akseptere eller bestride               │
└─────────────────────────────────────────────────────────────────┘
```

#### Alternativ B: Forsering (§33.8)

Hvis BH avslår fristkrav som TE mener er berettiget, kan TE varsle om forsering:

```
┌─────────────────────────────────────────────────────────────────┐
│                      FORSERING (§33.8)                           │
├─────────────────────────────────────────────────────────────────┤
│  1. BH avslår fristkrav                                         │
│  2. TE oppretter forseringssak (sakstype = "forsering")         │
│  3. Refererer til avslåtte fristkrav                            │
│  4. Beregner maks kostnad: (dager × dagmulkt) × 1.3             │
│  5. TE iverksetter forsering og kan kreve kostnader             │
└─────────────────────────────────────────────────────────────────┘
```

### Event-typer

Systemet har **35+ event-typer** fordelt på kategoriene:

| Kategori | Eksempler | Aktør |
|----------|-----------|-------|
| Grunnlag | `grunnlag_opprettet`, `grunnlag_oppdatert` | TE |
| Vederlag | `vederlag_krav_sendt`, `vederlag_krav_oppdatert` | TE |
| Frist | `frist_krav_sendt`, `frist_krav_oppdatert` | TE |
| Respons | `respons_grunnlag`, `respons_vederlag`, `respons_frist` | BH |
| Forsering | `forsering_varsel`, `forsering_respons` | TE/BH |
| Endringsordre | `eo_opprettet`, `eo_utstedt`, `eo_akseptert` | BH/TE |

**Se [ARCHITECTURE_AND_DATAMODEL.md](docs/ARCHITECTURE_AND_DATAMODEL.md)** for komplett event-oversikt og datamodeller.

---

## Arkitektur

### Event Sourcing-arkitektur

Systemet bruker **Event Sourcing med CQRS** (Command Query Responsibility Segregation):

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                   React 19 + TypeScript                         │
│              Oslo kommunes designsystem (Punkt)                 │
│                      Vite dev server                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP/REST (Events + Queries)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│              Flask 3 + Python + Pydantic v2                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   WRITE SIDE (Commands)              READ SIDE (Queries)        │
│  ┌──────────────────────┐          ┌──────────────────────┐    │
│  │ POST /api/events     │          │ GET /api/cases/{id}/ │    │
│  │ • Valider event      │          │     state            │    │
│  │ • Kjør forretnings-  │          │ • Hent events        │    │
│  │   regler             │          │ • Beregn SakState    │    │
│  │ • Persist til        │          │ • Returner projeksjon│    │
│  │   EventStore         │          └──────────────────────┘    │
│  └──────────────────────┘                    ▲                  │
│            │                                 │                  │
│            ▼                                 │                  │
│  ┌──────────────────────────────────────────┴─────────────┐    │
│  │              TimelineService (Projector)                │    │
│  │  • compute_state(events) → SakState                     │    │
│  │  • Tre spor: Grunnlag, Vederlag, Frist                  │    │
│  │  • Port-modell for NS 8407                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│      EVENT STORE            │  │         CATENDA             │
│  JsonFileEventRepository    │  │   Prosjekthotell            │
│  • Append-only log          │  │   Topics, Comments, Docs    │
│  • Optimistisk låsing       │  └─────────────────────────────┘
│  • Versjonsnummer           │
└─────────────────────────────┘
```

### Tre-spor modell (NS 8407)

```
SAK (Endringsmelding)
├── GRUNNLAG (Ansvar - "Hvorfor?")
│   ├── TE sender: GRUNNLAG_OPPRETTET
│   ├── TE oppdaterer: GRUNNLAG_OPPDATERT
│   └── BH svarer: RESPONS_GRUNNLAG
│
├── VEDERLAG (Betaling - "Hva koster det?")
│   ├── TE sender: VEDERLAG_KRAV_SENDT
│   ├── TE oppdaterer: VEDERLAG_KRAV_OPPDATERT
│   └── BH svarer: RESPONS_VEDERLAG (Port 1 + Port 2)
│
└── FRIST (Tidsfrist - "Hvor lang tid?")
    ├── TE sender: FRIST_KRAV_SENDT
    ├── TE oppdaterer: FRIST_KRAV_OPPDATERT
    └── BH svarer: RESPONS_FRIST (Port 1 + Port 2 + Port 3)
```

### NS 8407-implementasjon

Systemet implementerer NS 8407:2011 totalentreprisekontrakt:

| Spor/Sakstype | Hjemmel |
|---------------|---------|
| Grunnlag | §33.1 a-c, §33.3 |
| Vederlag | §34.1-34.4 |
| Frist | §33.4-33.7 |
| Forsering | §33.8 |
| Endringsordre | §31.3 |

**Se også:**
- [ARCHITECTURE_AND_DATAMODEL.md](docs/ARCHITECTURE_AND_DATAMODEL.md) - Port-modell, subsidiær logikk
- [NS8407_KONTROLLPLAN.md](docs/NS8407_KONTROLLPLAN.md) - Verifisering mot kontrakt

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
| @oslokommune/punkt-assets | 13.11 | Oslo kommunes designsystem |
| @react-pdf/renderer | 4.3 | PDF-generering |

### Backend

| Teknologi | Versjon | Formål |
|-----------|---------|--------|
| Python | 3.10+ | Språk |
| Flask | 3.0 | Web-rammeverk |
| Pydantic | 2.0+ | Datavalidering og modeller |
| pydantic-settings | 2.0+ | Miljøvariabel-håndtering |
| Flask-CORS | 4.0 | CORS-håndtering |
| Flask-Limiter | 3.5 | Rate limiting |
| requests | 2.31 | HTTP-klient |
| CloudEvents | 1.0 | Standardisert event-format (CNCF) |

---

## Kom i gang

### Platform Requirements

**Backend Development:**
- **Supported:** Linux, macOS, WSL2 on Windows
- **Not Supported:** Native Windows (due to file locking with `fcntl`)

**Frontend Development:**
- All platforms supported

**Production Deployment:**
- Azure Functions (Linux-based)

### Forutsetninger

- **Node.js** 18+ og npm
- **Python** 3.10+
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
├── src/                            # Frontend (React/TypeScript)
│   ├── App.tsx                     # Hovedkomponent med routing
│   ├── types/
│   │   └── timeline.ts             # Event/State-typer (speiler backend)
│   ├── api/
│   │   ├── events.ts               # Event submission med optimistisk låsing
│   │   ├── forsering.ts            # Forsering API-klient
│   │   ├── endringsordre.ts        # Endringsordre API-klient
│   │   └── client.ts               # HTTP-klient
│   ├── pages/
│   │   ├── ForseringPage.tsx       # Forsering-side
│   │   └── EndringsordePage.tsx    # Endringsordre-side
│   ├── components/
│   │   ├── layout/                 # Layout-komponenter
│   │   ├── panels/                 # Hovedpaneler (Grunnlag, Vederlag, Frist)
│   │   ├── forsering/              # Forsering-komponenter
│   │   ├── endringsordre/          # Endringsordre-komponenter
│   │   └── ui/                     # Gjenbrukbare UI-komponenter
│   ├── hooks/                      # Custom React hooks
│   └── utils/                      # Hjelpefunksjoner
│
├── backend/                        # Backend (Python/Flask)
│   ├── app.py                      # Flask entrypoint
│   │
│   ├── models/                     # Pydantic v2 modeller
│   │   ├── events.py               # Event-definisjoner
│   │   └── sak_state.py            # State-modeller (inkl. ForseringData, EndringsordreData)
│   │
│   ├── repositories/               # Data Access Layer
│   │   ├── event_repository.py     # Event store (optimistisk låsing)
│   │   └── sak_metadata_repository.py  # Metadata-cache
│   │
│   ├── services/                   # Forretningslogikk
│   │   ├── timeline_service.py     # State-projeksjon
│   │   ├── forsering_service.py    # Forsering-logikk og 30%-regel
│   │   ├── endringsordre_service.py # Endringsordre-logikk
│   │   └── business_rules.py       # Forretningsregler
│   │
│   ├── routes/
│   │   ├── event_routes.py         # Event API
│   │   ├── forsering_routes.py     # Forsering API-endepunkter
│   │   └── endringsordre_routes.py # Endringsordre API-endepunkter
│   │
│   ├── integrations/catenda/       # Catenda API-klient
│   ├── lib/                        # Auth, security, monitoring
│   │   └── cloudevents/            # CloudEvents-støtte (CNCF v1.0)
│   └── tests/                      # Testsuite
│
└── docs/                           # Dokumentasjon
```

Se [backend/STRUCTURE.md](backend/STRUCTURE.md) for detaljert backend-arkitektur.

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
- **Statuskoder** – Definert i backend (`constants/`) og frontend (`types/`)

---

## Dokumentasjon

| Dokument | Beskrivelse |
|----------|-------------|
| [ARCHITECTURE_AND_DATAMODEL.md](docs/ARCHITECTURE_AND_DATAMODEL.md) | Event sourcing, datamodeller, status-beregning |
| [GETTING_STARTED.md](docs/GETTING_STARTED.md) | Detaljert oppsettguide |
| [FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md) | Frontend-arkitektur og komponenter |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Azure-utrulling |
| [backend/STRUCTURE.md](backend/STRUCTURE.md) | Backend-mappestruktur (detaljert) |
| [CLOUDEVENTS_ADOPTION.md](docs/CLOUDEVENTS_ADOPTION.md) | CloudEvents-adopsjon og migrering |
| [architecture/workspace.dsl](docs/architecture/workspace.dsl) | C4-arkitekturdiagrammer (Structurizr DSL) |

---

## Testing

### Backend (427 tester, 63% coverage)

```bash
cd backend

# Kjør alle tester
python -m pytest tests/ -v

# Kjør med coverage (ekskluderer routes/)
python -m pytest --cov=services --cov=models --cov=repositories --cov=core --cov=constants --cov=api --cov-report=term-missing
```

**Testdekning (63% kjernelogikk, ekskl. routes/):**

| Modul | Coverage |
|-------|----------|
| repositories/event_repository.py | 99% |
| models/api_responses.py | 95% |
| models/events.py | 93% |
| services/endringsordre_service.py | 88% |
| services/catenda_service.py | 87% |
| services/forsering_service.py | 83% |
| services/business_rules.py | 80% |
| models/sak_state.py | 70% |

### Frontend (334 tester, 41% coverage)

```bash
# Kjør alle tester
npm test

# Kjør med UI
npm run test:ui

# Kjør med coverage
npm test -- --coverage --exclude='e2e/**'
```

### E2E (39 tester)

```bash
# Kjør E2E-tester (krever at backend og frontend kjører)
npm run test:e2e
```

E2E-testene dekker komplette brukerflyter med Playwright:
- Grunnlag-flyten (9 tester)
- Vederlag og frist-flyten (18 tester)
- Subsidiær forsering (8 tester)
- Smoke-tester (4 tester)

---

## Scripts

### Frontend

| Kommando | Beskrivelse |
|----------|-------------|
| `npm run dev` | Start utviklingsserver |
| `npm run build` | Bygg for produksjon |
| `npm run preview` | Forhåndsvis produksjonsbygg |
| `npm test` | Kjør tester |
| `npm run test:e2e` | Kjør E2E-tester (Playwright) |

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

- ✅ **Event Sourcing-arkitektur** med CQRS-mønster
- ✅ **Tre-spor modell** (Grunnlag, Vederlag, Frist) etter NS 8407
- ✅ **Port-modell** for strukturert vurdering (Port 1, 2, 3)
- ✅ **NS 8407-kategorier** – 4 hovedkategorier, 22 underkategorier med hjemmelreferanser
- ✅ **Forsering (§33.8)** – Komplett funksjonalitet med 30%-regel, kostnadsberegning og UI
- ✅ **Endringsordre (§31.3)** – Egen sakstype med KOE-samling, konsekvenser og TE-respons
- ✅ **Tre sakstyper** – `standard`, `forsering`, `endringsordre` med relasjoner mellom saker
- ✅ **Optimistisk låsing** med versjonsnummer for samtidighetskontroll
- ✅ **Event store** med append-only log og komplett historikk
- ✅ **State-projeksjon** via TimelineService
- ✅ **CloudEvents v1.0** - Standardisert event-format (CNCF-spesifikasjon)
- ✅ Catenda-integrasjon (API-klient, webhooks, magic links)
- ✅ PDF-generering og automatisk opplasting
- ✅ Sikkerhetstiltak (CSRF, validering, rate limiting, audit logging)

### Gjenstår for produksjon

- ⏳ Azure Landing Zone (infrastruktur)
- ⏳ DataverseRepository (erstatte JSON-filer)
- ⏳ Azure Functions-migrering
- ⏳ Redis for state (rate limiting, idempotency)

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
