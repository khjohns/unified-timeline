# Teknologivurdering: Custom-løsning vs. Power Platform

**Dokument:** Objektiv sammenligning av teknologialternativer
**Versjon:** 1.0
**Dato:** 2025-12-11

---

## Innhold

1. [Sammendrag](#1-sammendrag)
2. [Bakgrunn og formål](#2-bakgrunn-og-formål)
3. [Løsningsoversikt](#3-løsningsoversikt)
4. [Funksjonell sammenligning](#4-funksjonell-sammenligning)
5. [Teknisk sammenligning](#5-teknisk-sammenligning)
6. [Ressurs- og kompetansevurdering](#6-ressurs--og-kompetansevurdering)
7. [Kostnadsaspekter](#7-kostnadsaspekter)
8. [Risikovurdering](#8-risikovurdering)
9. [Usikkerheter som bør undersøkes](#9-usikkerheter-som-bør-undersøkes)
10. [Konklusjon](#10-konklusjon)

---

## 1. Sammendrag

Dette dokumentet sammenligner to teknologitilnærminger for håndtering av endringsmeldinger i byggeprosjekter etter NS 8407:

| Aspekt | Custom-løsning | Power Platform (foreslått) |
|--------|----------------|----------------------------|
| **Teknologi** | React/TypeScript + Python/Flask + Dataverse | Power Apps + Power Automate + SharePoint |
| **Arkitektur** | Event Sourcing med CQRS | CRUD-basert med SharePoint-lister |
| **Utviklingsmodell** | Kode-først | Low-code/No-code |
| **Kompleksitetshåndtering** | Full fleksibilitet | Betydelige begrensninger |

**Hovedfunn:**
- Custom-løsningen er implementert med event sourcing, subsidiær logikk og kompleks port-modell som følger NS 8407 nøyaktig
- Power Platform med SharePoint har strengere begrensninger enn med Dataverse (som ikke er i bruk i dag)
- SharePoint-basert løsning vil møte utfordringer med 5 000-elementers listeterskel, begrenset delegasjonsstøtte, og manglende felt-sikkerhet
- Valget avhenger av prioritering mellom: full funksjonalitet vs. intern kompetanseutnyttelse

**Merknad om Dataverse:** Dokumentet diskuterer også Dataverse som et potensielt alternativ til SharePoint dersom Power Platform velges. Dataverse er ikke i bruk i dag, men ville redusere noen av SharePoint-begrensningene (bredere delegasjonsstøtte, ingen listeterskel, felt-nivå sikkerhet).

---

## 2. Bakgrunn og formål

### 2.1 Kontekst

Løsningen skal håndtere endringsmeldinger (krav om endring - KOE) i totalentreprisekontrakter etter NS 8407. Dette innebærer:

- **Volum:** Estimert ~1 000 endringsmeldinger årlig, opptil 10 000 inkludert revisjoner
- **Brukere:** Interne (byggherre/BH) og eksterne (totalentreprenør/TE)
- **Integrasjon:** Tett kobling mot Catenda prosjekthotell (essensielt)
- **Juridisk kontekst:** Preklusjonsfrister med rettstapsvirkning

### 2.2 Strategisk kontekst

Løsningen inngår potensielt i en større digitaliseringsstrategi som dekker:
- Forprosjekt og planlegging
- Anskaffelse og konkurranse
- Gjennomføring (Catenda + endringsmeldinger)
- Forvaltning, drift og vedlikehold (FDV)

Et helhetlig datavarehus-perspektiv er relevant for fremtidig utvikling.

### 2.3 Formål med dokumentet

Gi et objektivt beslutningsgrunnlag for teknologivalg ved å:
- Beskrive begge alternativer nøytralt
- Identifisere styrker og svakheter
- Synliggjøre usikkerheter som krever nærmere undersøkelse

---

## 3. Løsningsoversikt

### 3.1 Custom-løsning (implementert)

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│              React 19 + TypeScript + Vite                       │
│            Oslo kommune designsystem (Punkt)                    │
└─────────────────────────────┬───────────────────────────────────┘
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│               Python/Flask → Azure Functions                    │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │  Event Sourcing + CQRS                                  │  │
│    │  • 19 event-typer                                       │  │
│    │  • State-projeksjon fra immutabel hendelseslogg         │  │
│    │  • Optimistisk låsing                                   │  │
│    └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
      │  Dataverse  │  │   Catenda   │  │  Entra ID   │
      │ Event Store │  │ Prosjekt-   │  │    SSO      │
      │             │  │ hotell      │  │             │
      └─────────────┘  └─────────────┘  └─────────────┘
```

**Nøkkelegenskaper:**
- Event Sourcing gir komplett historikk og audit trail
- Tre parallelle spor (Grunnlag, Vederlag, Frist) med uavhengige tilstandsmaskiner
- Port-modell for BH-vurdering (sekvensielle beslutningspunkter)
- Subsidiær logikk (prinsipal + alternativ vurdering)
- ~20 varslingsregler med preklusjonslogikk fra NS 8407

### 3.2 Power Platform-alternativ (foreslått: SharePoint)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Power Apps                                  │
│                      Canvas App                                  │
│                                                                 │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │  Skjemaer med Power Fx                                  │  │
│    │  • Ingen native business rules (SharePoint)             │  │
│    │  • Delegation limit: 500 rader                          │  │
│    └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Power Automate                               │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │  Arbeidsflyter                                          │  │
│    │  • Godkjenningsflyter                                   │  │
│    │  • Varsler og notifikasjoner                            │  │
│    │  • Integrasjoner (custom connectors = premium)          │  │
│    └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
      │ SharePoint  │  │   Custom    │  │  Entra ID   │
      │   Lister    │  │  Connector  │  │ / External  │
      │             │  │  (Catenda)  │  │     ID      │
      └─────────────┘  └─────────────┘  └─────────────┘
```

**Nøkkelegenskaper (SharePoint-variant):**
- Low-code utvikling med visuell designer
- SharePoint-lister som datalager (standard connector)
- Godkjenningsflyter med sekvensielle/parallelle trinn
- Premium-lisens kreves for custom connectors (Catenda)

**SharePoint vs. Dataverse:**

| Aspekt | SharePoint (foreslått) | Dataverse (alternativ) |
|--------|------------------------|------------------------|
| **Ikke-delegerbare spørringer** | 500 (kan økes til 2 000)¹ | 500 (kan økes til 2 000)¹ |
| **Delegerbare spørringer** | Begrenset støtte | Bred støtte |
| **Listeterskel** | 5 000 elementer | Ingen |
| **Business rules** | Ingen | Innebygd |
| **Relasjoner** | Lookup-kolonner (~12 per visning)² | Ekte relasjoner med integritet |
| **Transaksjoner** | Nei | Ja (ExecuteTransaction) |
| **Row-level security** | Begrenset | Robust |
| **Audit trail** | Versjonhistorikk | Komplett + Long-Term Retention |
| **Lisensiering** | Inkludert i M365 | Premium-lisens påkrevd |
| **Erfaring i org** | ✅ Eksisterende | ❌ Ikke i bruk |

**Fotnoter:**
1. 500 er standardgrense for ikke-delegerbare spørringer i Power Apps; kan økes til 2 000 i app-innstillinger.
2. ~12 lookup/people/managed-metadata-kolonner per *visning* kan utløse terskelfeil.

**Vurdering:** Hvis Power Platform velges, bør Dataverse vurderes fremfor SharePoint for å redusere tekniske begrensninger. Dette krever imidlertid Premium-lisensiering og kompetansebygging.

---

## 4. Funksjonell sammenligning

### 4.1 Kontraktslogikk og forretningsregler

#### NS 8407 varslingsregler

Løsningen implementerer ~20 varslingsregler fra NS 8407 med ulike fristtyper og konsekvenser:

| Fristtype | Eksempel | Custom | Power Platform |
|-----------|----------|--------|----------------|
| Uten ugrunnet opphold | §32.2, §33.4 | ✅ Dynamisk terskelberegning | ⚠️ Krever custom logikk |
| Spesifikke dager | §30.3.2 (14 dager) | ✅ Automatisk beregning | ✅ Mulig med Power Fx |
| Løpende | §30.3.1 (ukentlig) | ✅ Implementert | ✅ Mulig med recurrence |

**Vurdering:** Enkle fristberegninger kan gjøres i begge plattformer. Dynamiske terskler basert på kontekst (f.eks. "uten ugrunnet opphold" varierer fra 7-21 dager avhengig av type) krever mer arbeid i Power Platform.

#### Tre-spor modellen

Saksbehandlingen har tre uavhengige spor som kan behandles parallelt:

| Spor | Beskrivelse | Custom | Power Platform |
|------|-------------|--------|----------------|
| Grunnlag | "Hvorfor?" - Ansvarsgrunnlag | ✅ Uavhengig tilstandsmaskin | ⚠️ Kan modelleres, men komplekst |
| Vederlag | "Hvor mye?" - Kompensasjon | ✅ Port 1+2 vurdering | ⚠️ Multi-step mulig, men krevende |
| Frist | "Hvor lenge?" - Fristforlengelse | ✅ Port 1+2+3 vurdering | ⚠️ Som over |

**Vurdering:** Power Platform kan modellere parallelle spor via separate Dataverse-tabeller og relasjoner. Koordinering mellom sporene og aggregert statusberegning vil kreve Power Automate-flyter eller plugins.

#### Port-modellen (sekvensiell BH-vurdering)

BH vurderer krav gjennom sekvensielle "porter":

```
Vederlag:
├── Port 1: Varsling (preklusjonsvurdering)
│   └── Var varselet i tide? Ja/Nei per varseltype
└── Port 2: Beregning (utmåling)
    └── Godkjent beløp, metode, begrunnelse

Frist:
├── Port 1: Varsling (preklusjonsvurdering)
├── Port 2: Vilkår (årsakssammenheng)
│   └── Var det faktisk hindring?
└── Port 3: Utmåling
    └── Antall godkjente dager
```

| Aspekt | Custom | Power Platform |
|--------|--------|----------------|
| Multi-step wizard | ✅ 4-port wizard med tilstandshåndtering | ⚠️ Kan bygges med screens/tabs |
| Kryss-felt avhengigheter | ✅ Full kontroll | ⚠️ Business Rules har begrensninger* |
| Dynamisk synlighet | ✅ Komplekse regler | ⚠️ 10-15 regler håndterbart |

*Dataverse Business Rules kan ikke sammenligne forrige og nåværende verdi, eller bruke relaterte entiteter.

#### Subsidiær logikk

Det mest komplekse aspektet: BH tar **prinsipal stilling** men angir også **subsidiært standpunkt**:

```
Eksempel:
Prinsipalt:   "Grunnlaget avvises - TE har selv ansvaret"
Subsidiært:   "MEN hvis vi tar feil, er beløpet på 150 000 kr korrekt"

→ Systemet må beregne og vise BEGGE resultater
→ 8 mulige triggere for subsidiær vurdering
→ 256 teoretiske kombinasjoner
```

| Aspekt | Custom | Power Platform |
|--------|--------|----------------|
| Dual resultatberegning | ✅ Implementert | ❌ Ikke naturlig støttet |
| Kombinasjonslogikk | ✅ Håndterer alle 8 triggere | ⚠️ Ville kreve C# plugin |
| UI-visning av begge | ✅ Badge/indikator | ⚠️ Mulig, men komplekst |

**Vurdering:** Subsidiær logikk representerer den største utfordringen for Power Platform. Det krever enten:
- Duplisering av felter (prinsipal + subsidiær versjon av alt)
- Custom C# plugin for beregningslogikk
- Betydelig workaround med kalkulerte felter

### 4.2 Skjemaer og brukergrensesnitt

| Aspekt | Custom | Power Platform |
|--------|--------|----------------|
| **Designsystem** | Oslo kommune Punkt | Standard Microsoft |
| **Responsivitet** | Full kontroll | Canvas: God, Model-driven: Begrenset |
| **PDF-generering** | Client-side (@react-pdf) | ⚠️ Krever premium connector eller custom løsning |
| **Komplekse valideringer** | Zod schemas med refinements | Power Fx med begrensninger |

### 4.3 Integrasjoner

#### Catenda (prosjekthotell)

Custom-løsningen har en **ferdig utviklet, testet og validert** Catenda-integrasjon:

| Komponent | Beskrivelse | Linjer |
|-----------|-------------|--------|
| `CatendaClient` | REST v2 + BCF v3.0 API | 1 649 |
| `catenda/auth.py` | OAuth 2.0 (client credentials + user tokens) | 534 |
| `catenda_service.py` | Forretningslogikk for Catenda-operasjoner | 268 |
| `webhook_routes.py` | Webhook-mottak og håndtering | 164 |

**Implementert funksjonalitet:**
- OAuth 2.0 med automatisk token-refresh
- BCF 3.0 API (topics, comments, viewpoints)
- Document API v2 (upload, download, metadata)
- Project members og team-håndtering
- Webhook-mottak med signaturvalidering
- Interaktiv CLI-meny for testing (`catenda_menu.py`)

| Funksjon | Custom | Power Platform |
|----------|--------|----------------|
| Webhook-mottak | ✅ Implementert og testet | ⚠️ Power Automate HTTP trigger (premium) |
| Document API v2 | ✅ Fullt implementert | ⚠️ Custom connector må bygges |
| BCF 3.0 API | ✅ Fullt implementert | ⚠️ Custom connector må bygges |
| Team/rolle-inferens | ✅ Implementert | ⚠️ Custom connector + logikk |
| OAuth token-refresh | ✅ Automatisk | ⚠️ Må implementeres i connector |

**Vurdering:** For Power Platform må Catenda-integrasjonen bygges fra scratch:
- Custom connector klassifiseres som **Premium** og krever Premium-lisens for alle brukere som benytter funksjonen
- OAuth 2.0-flyt må konfigureres manuelt
- BCF 3.0-støtte finnes ikke som standard connector
- Webhook-mottak krever HTTP-trigger (også premium)
- Estimert utviklingsarbeid: Betydelig (sammenlign med 2 400+ linjer eksisterende kode)

#### Entra ID / External ID

| Aspekt | Custom | Power Platform |
|--------|--------|----------------|
| Intern SSO | ✅ Entra ID | ✅ Innebygd |
| Eksterne brukere | Magic links + Entra ID | Power Pages + External ID |
| Fleksibilitet | Høy (magic links 72t) | Middels (krever Microsoft-konto eller External ID) |

**Vurdering:** Power Platform kan gi eksterne tilgang via:
- **Microsoft Entra External ID** (anbefalt for nye prosjekter, GA i Power Pages 2025)
- Azure AD B2C (ikke tilgjengelig for nye kunder etter 1. mai 2025; B2C P2 avvikles 15. mars 2026; eksisterende kunder støttes minst til mai 2030)
- Begge krever oppsett og potensielt ekstra lisensiering

### 4.4 Samlet funksjonell vurdering

| Funksjon | Custom | Power Platform | Kommentar |
|----------|--------|----------------|-----------|
| Enkel saksregistrering | ✅ | ✅ | Likeverdige |
| Multi-step skjema | ✅ | ✅ | Power Apps kan bygge wizard |
| Tre-spor modell | ✅ | ⚠️ | Mulig, men krever arkitekturarbeid |
| Port-modell | ✅ | ⚠️ | Mulig med begrensninger |
| Subsidiær logikk | ✅ | ❌ | Krever custom utvikling |
| Varslingsfrister | ✅ | ⚠️ | Enkle OK, dynamiske krevende |
| Catenda-integrasjon | ✅ | ⚠️ | Premium + custom connector |
| Ekstern tilgang | ✅ | ⚠️ | Mulig med External ID/B2C |
| PDF-generering | ✅ | ⚠️ | Krever tillegg |

---

## 5. Teknisk sammenligning

### 5.1 Arkitekturmønstre

#### Event Sourcing vs. CRUD

| Aspekt | Event Sourcing (Custom) | CRUD (Power Platform) |
|--------|------------------------|----------------------|
| **Datamodell** | Immutabel hendelseslogg | Mutable rader |
| **Historikk** | Komplett - alle events bevart | Audit trail (Dataverse) |
| **State** | Beregnes fra events | Lagres direkte |
| **Replay** | Kan rekonstruere tilstand | Ikke mulig |
| **Kompleksitet** | Høyere | Lavere |

**Dataverse Auditing (2024-2025):**
- Logger CRUD-operasjoner på tabell-, kolonne- og miljønivå
- Konfigurerbar retention (90 dager til 1+ år)
- **Long-Term Retention (LTR)** for kostnadseffektiv langtidslagring av historikk
- AI-assistert endringssporing
- Kan eksporteres til Azure Synapse Link for analyse
- Støtter **ExecuteTransaction** for ACID-transaksjoner ved samtidige oppdateringer

**Vurdering:** Event Sourcing gir sterkere garantier for historikk og audit trail, men Dataverse auditing med LTR kan være tilstrekkelig for mange formål. Forskjellen er viktigst når:
- Man trenger å rekonstruere tilstand på et vilkårlig tidspunkt (event sourcing)
- Man vil "replay" events for debugging/analyse (event sourcing)
- Det er juridiske krav til komplett sporbarhet (begge kan dekke dette)

#### Optimistisk låsing

| Aspekt | Custom | Power Platform |
|--------|--------|----------------|
| Implementasjon | Versjonsnummer per sak | Dataverse RowVersion |
| Konfliktdeteksjon | `expected_version != actual` | ETag / OData-ETag header |
| Konfliktløsning | Klient re-henter og bekrefter | Må implementeres manuelt |

**Vurdering:** Begge plattformer støtter optimistisk låsing, men mekanismene er forskjellige. Custom-løsningen har eksplisitt implementasjon, Power Platform bruker OData-standarder.

### 5.2 Datahåndtering og lagring

#### JSON-håndtering

| Aspekt | Custom | SharePoint | Dataverse |
|--------|--------|------------|-----------|
| Event-data | JSON-payload per event | Multiline Text | Multiline Text + ParseJSON |
| Native JSON-kolonne | ✅ (Azure) | ❌ Nei | ❌ Nei |
| Nested objekter | ✅ Full støtte | ❌ Må flates helt ut | ⚠️ Må serialiseres |

**Vurdering:** Custom-løsningen lagrer komplekse event-payloads som JSON. SharePoint-basert løsning må:
- Opprette separate kolonner for hvert felt (SharePoint har maks ~400 kolonner per liste)
- Bruke flere lister med lookup-relasjoner (kompliserer queries)
- Miste muligheten for nested data uten betydelig workaround

#### Delegering og ytelse

| Aspekt | Custom | SharePoint | Dataverse |
|--------|--------|------------|-----------|
| Ikke-delegerbare spørringer | N/A | 500 (kan økes til 2 000)¹ | 500 (kan økes til 2 000)¹ |
| Delegerbare spørringer | N/A | Server-side, men begrenset² | Server-side, bred støtte |
| Listevisningsterskel | N/A | **5 000 elementer**³ | Ingen |
| Store datasett | Azure skalering | ⚠️ Krever indeksering/filtrering | ⚠️ Krever delegerbare queries |
| Aggregering | Backend-beregning | Meget begrenset | 50 000 rader maks |
| Indeksering | Full kontroll | Maks 20 indekserte kolonner | Automatisk |

**Fotnoter:**
1. I Power Apps er 500 standardgrense for *ikke-delegerbare* spørringer (kan økes til 2 000 i app-innstillinger). Ved *delegerbare* spørringer kjøres filtrering/sortering på server.
2. SharePoint har begrenset delegasjonsstøtte sammenlignet med Dataverse.
3. SharePoints 5 000-visningsterskel håndheves i Online-tjenesten. Indekserte kolonner og filtrerte visninger er anbefalt mitigasjon, men grensen fjernes ikke.

**Estimert volum:** ~1 000 saker/år × 10-15 events/sak = **10 000-15 000 events/år**

**Vurdering for SharePoint:**
- Med ikke-delegerbare spørringer (f.eks. komplekse filtre) vil maks 500-2 000 rader returneres
- SharePoints listevisningsterskel på 5 000 elementer vil nås innen 1-2 år uten arkivering
- Søk på tvers av alle saker krever delegasjonssikre formler og indekserte kolonner
- Indeksering og filtrerte visninger kan avhjelpe, men krever bevisst informasjonsarkitektur

**Hvis Dataverse velges i stedet:**
- Bredere delegasjonsstøtte gjør at flere spørringer kjører server-side
- Ingen listevisningsterskel
- Bedre ytelse på store datasett

### 5.3 Skalerbarhet

| Aspekt | Custom | SharePoint | Dataverse |
|--------|--------|------------|-----------|
| **Horisontal skalering** | Azure Functions autoscaling | Microsoft-håndtert | Microsoft-håndtert |
| **Datalagringsgrense** | Ubegrenset (Azure) | Begrenset per site | Kapasitetsbasert |
| **API-kall (per 24t)** | Ubegrenset (egen backend) | Throttling-grenser | Se tabell under |
| **Listeterskel** | N/A | **5 000 elementer** | Ingen |
| **Flow-begrensninger** | N/A | 500 actions per flow | 500 actions per flow |

**Power Platform API-forespørselsgrenser (per 2025):**

| Lisenstype | Grense per 24 timer |
|------------|---------------------|
| Betalte brukerlisenser (Power Apps/Automate/D365) | 40 000 |
| Microsoft 365-seeded / Per-app | 6 000 |
| Per-flow plan | 250 000 |

**Power Automate-begrensninger (gjelder begge):**
- Maks 500 actions per flow
- Flyter som throttles kontinuerlig i 14 dager kan bli slått av automatisk
- Flyter uten vellykkede kjøringer på ~90 dager kan auto-deaktiveres (inaktivitet)
- SharePoint connector: ~600 kall/min (veiledende; design for å unngå bursts)

**SharePoint-spesifikke begrensninger:**
- Listevisningsterskel: 5 000 elementer (indeksering/filtrerte visninger anbefalt)
- Ingen transaksjonsstøtte (kan ikke rulle tilbake flere operasjoner)
- Lookup-kolonner: ~12 lookup/people/managed-metadata-kolonner per *visning* kan utløse terskelfeil
- Beregnet kolonne-begrensninger

### 5.4 Sikkerhet og tilgangskontroll

| Aspekt | Custom | SharePoint | Dataverse |
|--------|--------|------------|-----------|
| **Autentisering** | Entra ID + Magic Links | Entra ID | Entra ID + External ID/B2C |
| **Autorisasjon** | Rolle-basert (TE/BH) i kode | SharePoint-grupper | Security Roles |
| **Felt-nivå tilgang** | Implementert i backend | ❌ Ikke støttet | Field Security Profiles |
| **Row-Level Security** | Planlagt (Dataverse) | Begrenset (item permissions) | ✅ Robust |
| **Eksterne brukere** | Magic links (fleksibelt) | Gjestetilgang | External ID/B2C |

**Vurdering:**
- SharePoint mangler felt-nivå sikkerhet, noe som er problematisk når TE ikke skal se BH-felter og vice versa
- SharePoint item-level permissions skalerer dårlig (anbefalt maks ~5 000 unike permissions)
- Dataverse har langt mer robuste sikkerhetsfunksjoner, men krever Premium-lisens

---

## 6. Ressurs- og kompetansevurdering

### 6.1 Utviklingskompetanse

| Kompetanse | Custom | Power Platform (SharePoint) | Power Platform (Dataverse) |
|------------|--------|----------------------------|---------------------------|
| **Primært språk** | TypeScript, Python | Power Fx | Power Fx + evt. C# |
| **Frontend** | React-erfaring | Canvas App designer | Canvas/Model-driven |
| **Backend** | Python/Node.js | Power Automate | Power Automate + plugins |
| **Database** | SQL/Dataverse | SharePoint-lister | Dataverse-tabeller |
| **Læringskurve** | Bratt for low-code erfarne | Kjent for org | Ny for org |

### 6.2 Vedlikeholdskompetanse

| Aspekt | Custom | Power Platform |
|--------|--------|----------------|
| **Daglig drift** | DevOps-kunnskap | Power Platform Admin Center |
| **Feilsøking** | Kode-debugging | Flow-historikk, App Insights |
| **Endringer i logikk** | Kodeendring + deploy | App-endring (kan være enklere) |
| **NS 8407-oppdateringer** | Kodeendring | Avhengig av kompleksitet |

### 6.3 Eksisterende kompetanse (antatt)

Basert på oppgitt informasjon:
- ✅ Canvas Apps-erfaring (titalls apps i bruk)
- ✅ Power Automate-erfaring
- ✅ SharePoint-erfaring
- ⚠️ Ikke Dataverse-erfaring
- ⚠️ Ikke kompleks forretningslogikk i Power Platform
- ❓ TypeScript/React-kompetanse (ukjent)
- ❓ Python-kompetanse (ukjent)

---

## 7. Kostnadsaspekter

### 7.1 Lisensiering

#### Power Platform

| Lisenstype | Pris (ca.) | Inkluderer |
|------------|------------|------------|
| Per App Plan | $5/bruker/app/mnd | Én app, standard connectors |
| Per User Premium | $20/bruker/mnd | Ubegrenset apps, premium connectors |
| Dataverse | Inkludert i Premium | Database-kapasitet |
| External ID | Gratis opptil 50 000 MAU | Eksterne brukere |

**Viktig:** Custom connectors (som Catenda-integrasjon) klassifiseres som Premium og krever Premium-lisens for alle brukere av appen.

#### Custom-løsning (Azure)

| Komponent | Estimert kostnad |
|-----------|------------------|
| Azure Static Web Apps | Gratis tier eller ~$9/mnd |
| Azure Functions | Consumption plan: betaler per kjøring |
| Dataverse | Avhenger av kapasitet |
| Entra ID | Inkludert i M365 |

**Merk:** Detaljert kostnadssammenligning krever konkrete brukerantall og bruksmønstre.

### 7.2 Utviklingskostnad

| Fase | Custom | Power Platform |
|------|--------|----------------|
| **Utvikling** | Allerede gjennomført | Må bygges fra scratch |
| **Catenda-integrasjon** | Implementert | Custom connector + konfig |
| **Subsidiær logikk** | Implementert | Krever custom C# plugin |
| **Opplæring** | Avhenger av kompetanse | Avhenger av kompleksitet |

### 7.3 Vedlikeholdskostnad

Vanskelig å estimere uten mer data. Faktorer:
- Hvor ofte endres NS 8407-reglene?
- Hvor mye intern vs. ekstern kompetanse?
- Brukerstøttebehov?

---

## 8. Risikovurdering

### 8.1 Custom-løsning

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Avhengighet av nøkkelpersonell | Middels | Høy | Dokumentasjon, kunnskapsoverføring |
| Teknologisk gjeld | Lav-Middels | Middels | Moderne stack, vedlikehold |
| Skaleringsutfordringer | Lav | Middels | Azure autoscaling |
| Sikkerhetshull | Lav | Høy | Security review, WAF |

### 8.2 Power Platform (SharePoint-variant)

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| **Delegation limit (500 rader)** | **Høy** | **Høy** | Bytte til Dataverse |
| **Listeterskel (5 000 elementer)** | **Høy** | **Høy** | Arkivering/splitting av lister |
| Manglende felt-sikkerhet | Høy | Middels | Separate lister per rolle |
| Funksjonelle begrensninger | Høy | Høy | Forenkling av scope |
| Custom connector-vedlikehold | Middels | Middels | Intern kompetanse |

### 8.3 Power Platform (Dataverse-alternativ)

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Manglende kompetanse | Høy | Middels | Opplæring, konsulentbistand |
| Delegation limits (2000) | Middels | Middels | God filtrering |
| Premium-lisenskostnad | Middels | Middels | Budsjettplanlegging |
| Subsidiær logikk i C# | Høy | Høy | Forenkle eller ekstern bistand |

### 8.4 Juridisk risiko (begge)

Feil i preklusjonslogikk eller subsidiær vurdering kan ha økonomiske konsekvenser. Dette gjelder uavhengig av teknologivalg, men:
- Custom-løsningen har implementert logikken eksplisitt
- Power Platform ville kreve re-implementering med risiko for feil

---

## 9. Usikkerheter som bør undersøkes

Følgende punkter bør avklares før endelig beslutning:

### 9.1 Power Platform-spesifikke

#### SharePoint-variant (foreslått)

| Tema | Spørsmål | Hvorfor viktig |
|------|----------|----------------|
| **500-raders grense** | Hvordan skal sakliste fungere med >500 saker? | Fundamental begrensning |
| **5 000-elementers terskel** | Når nås denne grensen? Hva er planen da? | Ytelse og arkitektur |
| **Felt-sikkerhet** | Hvordan skille TE/BH-felter uten felt-nivå sikkerhet? | Sikkerhetskrav |
| **Catenda connector** | Må bygges fra scratch (2 400+ linjer i custom-løsningen) | Betydelig utviklingsarbeid |

#### Dataverse-alternativ

| Tema | Spørsmål | Hvorfor viktig |
|------|----------|----------------|
| **Premium-lisensiering** | Hva koster Dataverse-kapasitet for estimert brukervolum? | Budsjettering |
| **Kompetansebygging** | Hvor lang tid tar det å bygge Dataverse-kompetanse? | Prosjekttidsplan |
| **Plugin-kompetanse** | Finnes intern kompetanse på Dataverse C# plugins? | Subsidiær logikk |
| **LTR-strategi** | Skal historikk lagres med Long-Term Retention for koststyring? | Arkitektur og kostnad |

### 9.2 Custom-løsning-spesifikke

| Tema | Spørsmål | Hvorfor viktig |
|------|----------|----------------|
| **Kompetanse** | Hvem skal vedlikeholde TypeScript/Python-kode? | Langsiktig bærekraft |
| **Deploy-ansvar** | Hvem har ansvar for Azure-infrastruktur? | Driftsmodell |
| **Support-avtale** | Trengs ekstern support-avtale? | Kostnadsestimering |

### 9.3 Generelle

| Tema | Spørsmål | Hvorfor viktig |
|------|----------|----------------|
| **Datavarehus-strategi** | Hvordan passer hver løsning inn i fremtidig datavarehus? | Strategisk alignment |
| **Catenda-roadmap** | Planlegger Catenda egne Power Platform-integrasjoner? | Kan endre vurderingen |
| **NS 8407-revisjoner** | Forventes vesentlige endringer i standarden? | Vedlikeholdsbehov |
| **Brukervolum** | Nøyaktig antall interne vs. eksterne brukere? | Lisenskostnad |

---

## 10. Konklusjon

### 10.1 Objektiv oppsummering

**Custom-løsningen:**
- ✅ Implementerer full NS 8407-logikk inkludert subsidiær vurdering
- ✅ Event Sourcing gir komplett audit trail og replay-mulighet
- ✅ Catenda-integrasjon er ferdig utviklet (2 400+ linjer)
- ✅ Ingen volumbegrensninger
- ⚠️ Krever vedlikeholdskompetanse på TypeScript/Python
- ⚠️ Avhengighet av spesifikk teknologikompetanse

**Power Platform + SharePoint (foreslått):**
- ✅ Utnytter eksisterende organisatorisk kompetanse
- ✅ Ingen ekstra lisensiering (inkludert i M365)
- ❌ **500 raders delegation limit** - kritisk ved 1000+ saker/år
- ❌ **5 000 elementers listeterskel** - nås innen 1-2 år
- ❌ Ingen felt-nivå sikkerhet (TE/BH-separasjon problematisk)
- ❌ Catenda-integrasjon må bygges fra scratch
- ⚠️ Subsidiær logikk kan ikke implementeres

**Power Platform + Dataverse (alternativ):**
- ✅ Bedre skalerbarhet enn SharePoint (2000 raders grense)
- ✅ Felt-nivå sikkerhet og robuste relasjoner
- ✅ Strategisk plattform for fremtidig datavarehus
- ⚠️ Krever Premium-lisensiering
- ⚠️ Ingen eksisterende kompetanse i organisasjonen
- ⚠️ Subsidiær logikk krever C# plugin-utvikling
- ⚠️ Catenda-integrasjon må fortsatt bygges

### 10.2 Scenariobasert vurdering

| Scenario | Custom | SharePoint | Dataverse |
|----------|--------|------------|-----------|
| Full NS 8407-støtte | ✅ Anbefalt | ❌ Ikke mulig | ⚠️ Krever plugins |
| Volum >500 saker | ✅ Ingen problem | ❌ Kritisk | ⚠️ Håndterbart |
| Volum >5000 events | ✅ Ingen problem | ❌ Kritisk | ✅ OK |
| Eksisterende kompetanse | ⚠️ Ny | ✅ Kjent | ⚠️ Ny |
| Catenda-integrasjon | ✅ Ferdig | ❌ Må bygges | ❌ Må bygges |
| Tid til produksjon | ✅ Kort | ⚠️ Lang | ⚠️ Lang |
| Felt-sikkerhet (TE/BH) | ✅ Implementert | ❌ Ikke mulig | ✅ Mulig |
| Fremtidig datavarehus | ✅ Via Dataverse | ⚠️ Begrenset | ✅ God match |

### 10.3 Anbefaling for fremtidig Dataverse-satsing

Hvis organisasjonen ønsker å satse på Dataverse som strategisk plattform for datavarehus, kan følgende tilnærming vurderes:

1. **Kort sikt:** Bruk custom-løsningen (allerede ferdig) med Dataverse som event store
2. **Mellomlang sikt:** Bygg Dataverse-kompetanse på enklere prosjekter
3. **Lang sikt:** Evaluer migrering av UI-lag til Power Platform når kompetansen er på plass

Dette gir:
- Umiddelbar produksjonskapasitet
- Dataverse som felles datalager for begge tilnærminger
- Tid til kompetansebygging uten tidspress

### 10.4 Beslutningsfaktorer

Endelig valg bør baseres på:

1. **Volumkrav:** Med 10 000+ events/år er SharePoint-varianten teknisk problematisk
2. **Funksjonskrav:** Er subsidiær logikk et må-krav? (Hvis ja → Custom)
3. **Kompetansestrategi:** Bygge intern TypeScript/Python-kompetanse eller satse på Power Platform?
4. **Datavarehus-strategi:** Dataverse bør vurderes uavhengig av UI-valg
5. **Total eierskapskostnad:** Lisenser + utvikling + vedlikehold over 5+ år

---

## Vedlegg

### A. Referanser til kildekode

| Fil | Beskrivelse | Linjer |
|-----|-------------|--------|
| `src/constants/varslingsregler.ts` | NS 8407 varslingsregler | ~380 |
| `src/types/timeline.ts` | Datamodeller og state-typer | ~900 |
| `backend/services/timeline_service.py` | Event sourcing og state-projeksjon | 753 |
| `backend/models/events.py` | Event-definisjoner | 933 |
| `backend/models/sak_state.py` | Read model (projeksjon) | 562 |
| `backend/integrations/catenda/client.py` | Catenda REST + BCF API | 1 649 |
| `backend/integrations/catenda/auth.py` | OAuth 2.0 autentisering | 534 |
| `backend/services/business_rules.py` | Forretningsregler-validering | 240 |

**Total backend:** ~13 700 linjer (59 filer, 345 tester)

For komplett backend-struktur, se [backend/STRUCTURE.md](../backend/STRUCTURE.md).

### B. Kilder for Power Platform-vurdering

**Delegering og grenser:**
- [Power Apps delegation overview](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview)
- [SharePoint list view threshold](https://learn.microsoft.com/en-us/troubleshoot/sharepoint/lists-and-libraries/items-exceeds-list-view-threshold)
- [Working with list view threshold limits](https://support.microsoft.com/en-us/office/working-with-the-list-view-threshold-limit-for-all-versions-of-sharepoint-4a40bbdc-c5f8-4bbd-b9b6-745daf71c132)

**Power Automate:**
- [Power Automate limits and configuration](https://learn.microsoft.com/en-us/power-automate/limits-and-config)
- [Understand limits to avoid throttling](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/understand-limits)

**Lisensiering og API-grenser:**
- [Power Platform Licensing Guide (June 2025)](https://www.microsoft.com/content/dam/microsoft/final/en-us/microsoft-brand/documents/Power-Platform-Licensing-Guide-June-2025.pdf)
- [Request limits and allocations](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations)
- [About Power Apps per app plan](https://learn.microsoft.com/en-us/power-platform/admin/about-powerapps-perapp)
- [Custom connectors overview](https://learn.microsoft.com/en-us/connectors/custom-connectors/)

**Dataverse:**
- [Manage Dataverse auditing](https://learn.microsoft.com/en-us/power-platform/admin/manage-dataverse-auditing)
- [Data retention overview (LTR)](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/data-retention-overview)
- [Use ExecuteTransaction](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/org-service/use-executetransaction)

**Ekstern identitet:**
- [Azure AD B2C FAQ (end-of-sale/support)](https://learn.microsoft.com/en-us/azure/active-directory-b2c/faq)
- [Configure Entra External ID in Power Pages](https://learn.microsoft.com/en-us/power-pages/security/authentication/entra-external-id)
- [2025 Wave 1: Entra External ID in Power Pages](https://learn.microsoft.com/en-us/power-platform/release-plan/2025wave1/power-pages/utilize-entra-external-id-power-pages)

### C. Relatert dokumentasjon

- [ARCHITECTURE_AND_DATAMODEL.md](ARCHITECTURE_AND_DATAMODEL.md) - Detaljert arkitekturbeskrivelse
- [DEPLOYMENT.md](DEPLOYMENT.md) - Produksjonsutrulling
- [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) - Sikkerhetslag
