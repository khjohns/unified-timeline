# Skjema Endringsmeldinger

**Digital samhandlingsplattform for strukturerte endringsmeldinger i byggeprosjekter**

Et system for håndtering av endringsordrer (KOE) etter NS 8407:2011, integrert med prosjekthotellet Catenda. Utviklet av Oslobygg KF for å erstatte manuelle PDF/Word-baserte prosesser med strukturerte, sporbare data.

**Sist oppdatert:** 2025-12-08

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

Prosessen følger NS 8407:2011 for håndtering av krav om endring (KOE), implementert med event sourcing og tre parallelle spor.

### Oversikt

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SAK (KOE)                                       │
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
│                                    │                                         │
│                                    ▼                                         │
│                            ┌──────────────┐                                 │
│                            │  EO UTSTEDT  │                                 │
│                            └──────────────┘                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

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
• avvist                  Port 2: Beregning          Port 2: Beregning
• subsidiær_godkjenning   • godkjent_fullt           • godkjent_fullt
                          • delvis_godkjent          • delvis_godkjent
→ respons_grunnlag        • avslatt_totalt           • avslatt_ingen_hindring

                          → respons_vederlag         Port 3: Frist
                                                     • (tid-spesifikk vurdering)

                                                     → respons_frist
```

Ved delvis godkjenning eller avvisning kan TE sende revidert krav:
- `grunnlag_oppdatert` / `vederlag_krav_oppdatert` / `frist_krav_oppdatert`

### Steg 5: Endringsordre (EO)

Når alle spor er avklart, kan endringsordre utstedes:

```
┌─────────────────┐
│  EO UTSTEDES    │  → Event: eo_utstedt
│                 │  Saken avsluttes.
│  (Ikke impl.    │
│   i prototype)  │
└─────────────────┘
```

### Event-oversikt

| Event | Aktør | Beskrivelse |
|-------|-------|-------------|
| `sak_opprettet` | System | Sak opprettes fra Catenda webhook |
| `grunnlag_opprettet` | TE | Første innsending av ansvarsgrunnlag |
| `grunnlag_oppdatert` | TE | Revidert grunnlag |
| `vederlag_krav_sendt` | TE | Vederlagskrav sendes |
| `vederlag_krav_oppdatert` | TE | Revidert vederlagskrav |
| `frist_krav_sendt` | TE | Fristkrav sendes |
| `frist_krav_oppdatert` | TE | Revidert fristkrav |
| `respons_grunnlag` | BH | Svar på grunnlag (Port 1) |
| `respons_vederlag` | BH | Svar på vederlag (Port 1+2) |
| `respons_frist` | BH | Svar på frist (Port 1+2+3) |
| `eo_utstedt` | BH | Endringsordre utstedt |

**Merk:** Databaselagring til Dataverse og EO-skjema er planlagt for produksjon.

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
│   ├── App.tsx                     # Hovedkomponent
│   ├── types/
│   │   └── timeline.ts             # Event/State-typer (speiler backend)
│   ├── api/
│   │   ├── events.ts               # Event submission med optimistisk låsing
│   │   └── client.ts               # HTTP-klient
│   ├── components/
│   │   ├── layout/                 # Layout-komponenter
│   │   ├── panels/                 # Hovedpaneler (Grunnlag, Vederlag, Frist)
│   │   └── ui/                     # Gjenbrukbare UI-komponenter
│   ├── hooks/                      # Custom React hooks
│   └── utils/                      # Hjelpefunksjoner
│
├── backend/                        # Backend (Python/Flask)
│   ├── app.py                      # Flask entrypoint
│   │
│   ├── models/                     # Pydantic v2 modeller
│   │   ├── events.py               # Event-definisjoner (992 linjer)
│   │   └── sak_state.py            # Read model/projeksjon (643 linjer)
│   │
│   ├── repositories/               # Data Access Layer
│   │   ├── event_repository.py     # Event store (optimistisk låsing)
│   │   └── sak_metadata_repository.py  # Metadata-cache
│   │
│   ├── services/                   # Forretningslogikk
│   │   ├── timeline_service.py     # State-projeksjon (772 linjer)
│   │   └── business_rules.py       # Forretningsregler (239 linjer)
│   │
│   ├── routes/
│   │   └── event_routes.py         # Event API (591 linjer)
│   │
│   ├── integrations/catenda/       # Catenda API-klient
│   ├── lib/                        # Auth, security, monitoring
│   └── tests/                      # Testsuite
│
└── docs/                           # Dokumentasjon
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
- **Statuskoder** – Definert i backend (`constants/`) og frontend (`types/`)

---

## Dokumentasjon

| Dokument | Beskrivelse |
|----------|-------------|
| [GETTING_STARTED.md](docs/GETTING_STARTED.md) | Detaljert oppsettguide |
| [FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md) | Frontend-arkitektur og komponenter |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Azure-utrulling |
| [backend/STRUCTURE.md](backend/STRUCTURE.md) | Backend-mappestruktur (detaljert) |

---

## Testing

### Backend (345 tester, 32% coverage)

```bash
cd backend

# Kjør alle tester
python -m pytest tests/ -v

# Kjør med coverage
python -m pytest tests/ --cov=. --cov-report=html

# Manuell API-testing
./scripts/manual_testing.sh
```

**Testdekning (32% totalt):**

| Kategori | Filer | Coverage |
|----------|-------|----------|
| Models | 2 filer | 95-100% |
| Services | 2 filer | 87-89% |
| Security | 4 filer | 73-95% |
| Repositories | 2 filer | 95-99% |
| Utils | 3 filer | 100% |

### Frontend

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
- ✅ **Optimistisk låsing** med versjonsnummer for samtidighetskontroll
- ✅ **Event store** med append-only log og komplett historikk
- ✅ **State-projeksjon** via TimelineService
- ✅ Catenda-integrasjon (API-klient, webhooks, magic links)
- ✅ PDF-generering og automatisk opplasting
- ✅ Sikkerhetstiltak (CSRF, validering, rate limiting, audit logging)

### Gjenstår for produksjon

- ⏳ Azure Landing Zone (infrastruktur)
- ⏳ DataverseRepository (erstatte JSON-filer)
- ⏳ Azure Functions-migrering
- ⏳ Redis for state (rate limiting, idempotency)
- ⏳ EO-hendelse (endringsordre-utstedelse)

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
