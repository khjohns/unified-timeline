# Skjema Endringsmeldinger

**Digital samhandlingsplattform for strukturerte endringsmeldinger i byggeprosjekter**

Et system for håndtering av endringsordrer (KOE) etter NS 8407:2011, integrert med prosjekthotellet Catenda. Utviklet av Oslobygg KF for å erstatte manuelle PDF/Word-baserte prosesser med strukturerte, sporbare data.

---

## Innhold

- [Om prosjektet](#om-prosjektet)
- [Arkitektur](#arkitektur)
- [Teknologier](#teknologier)
- [Kom i gang](#kom-i-gang)
- [Prosjektstruktur](#prosjektstruktur)
- [Gjenbrukbarhet](#gjenbrukbarhet)
- [Dokumentasjon](#dokumentasjon)
- [Testing](#testing)
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

### Arbeidsflyt

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. VARSEL      │────▶│  2. KOE         │────▶│  3. BH SVAR     │
│  Entreprenør    │     │  Entreprenør    │     │  Byggherre      │
│  varsler om     │     │  fremmer krav   │     │  godkjenner/    │
│  forhold        │     │  om endring     │     │  avslår         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  4. EO          │
                                               │  Endringsordre  │
                                               │  utstedes       │
                                               └─────────────────┘
```

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
│                    Flask 3 + Python                             │
│                  Pydantic v2 validering                         │
├─────────────────────────────────────────────────────────────────┤
│  Routes ──▶ Services ──▶ Repositories ──▶ CSV (lokal lagring)  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Catenda API
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CATENDA                                  │
│            Prosjekthotell (ekstern tjeneste)                    │
│         Topics, Comments, Documents, Webhooks                   │
└─────────────────────────────────────────────────────────────────┘
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

Se [HLD - Overordnet Design](docs/HLD%20-%20Overordnet%20Design.md) for detaljert arkitekturbeskrivelse.

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
| Pydantic | 2.0+ | Datavalidering |
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
├── 📁 src/                      # Frontend React-kode
│   ├── components/              # React-komponenter
│   │   ├── panels/              # Hovedpaneler (Varsel, KOE, Svar, etc.)
│   │   └── ui/                  # Gjenbrukbare UI-komponenter
│   ├── hooks/                   # Custom React hooks
│   ├── services/                # API-klient og forretningslogikk
│   ├── utils/                   # Hjelpefunksjoner og PDF-generering
│   └── types.ts                 # TypeScript-definisjoner
│
├── 📁 backend/                  # Backend Python-kode
│   ├── routes/                  # Flask blueprints (HTTP-endepunkter)
│   ├── services/                # Forretningslogikk
│   ├── repositories/            # Dataaksess (CSV, fremtidig Dataverse)
│   ├── models/                  # Pydantic-modeller
│   ├── integrations/catenda/    # Catenda API-klient
│   ├── lib/                     # Gjenbrukbare moduler (auth, security)
│   └── scripts/                 # CLI-verktøy
│
├── 📁 docs/                     # Dokumentasjon
│   ├── HLD - Overordnet Design.md
│   ├── GETTING_STARTED.md
│   ├── API.md
│   └── ...
│
├── 📁 shared/                   # Delt konfigurasjon
│   └── status-codes.json        # Statuskoder (brukes av frontend og backend)
│
└── 📁 public/                   # Statiske assets
    └── logos/
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
| [backend/STRUCTURE.md](backend/STRUCTURE.md) | Backend-mappestruktur |
| [Refaktoreringsplan - Backend](docs/Refaktoreringsplan%20-%20Backend.md) | Backend-refaktorering |
| [Handlingsplan Sikkerhetstiltak](docs/Handlingsplan_Sikkerhetstiltak.md) | Sikkerhetsimplementering |

---

## Testing

### Frontend

```bash
# Kjør alle tester
npm test

# Kjør med UI
npm run test:ui

# Kjør med coverage
npm run test:coverage
```

### Backend

```bash
cd backend

# Kjør alle tester
python -m pytest tests/ -v

# Kjør med coverage
python -m pytest tests/ --cov=. --cov-report=html
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
| `python scripts/catenda_menu.py` | Interaktiv Catenda API-meny |
| `python scripts/setup_webhooks.py` | Konfigurer Catenda webhooks |

---

## Status

🟡 **Prototype** – Under aktiv utvikling

- ✅ Frontend med alle paneler (Varsel, KOE, BH Svar, Oppsummering)
- ✅ Backend med lagdelt arkitektur
- ✅ Catenda-integrasjon (API-klient, webhooks)
- ✅ PDF-generering
- ✅ Testrammeverk (frontend og backend)
- 🔄 Sikkerhetstiltak (delvis implementert)
- ⏳ Azure Functions-migrering
- ⏳ Dataverse-integrasjon

---

## Bidrag

Prosjektet er utviklet av Oslobygg KF. For spørsmål eller bidrag, kontakt prosjektteamet.

---

## Lisens

*[Lisensinfo legges til]*
