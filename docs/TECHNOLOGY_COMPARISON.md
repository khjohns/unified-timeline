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

| Aspekt | Custom-løsning | Power Platform |
|--------|----------------|----------------|
| **Teknologi** | React/TypeScript + Python/Flask + Dataverse | Power Apps + Power Automate + Dataverse |
| **Arkitektur** | Event Sourcing med CQRS | CRUD-basert med audit trail |
| **Utviklingsmodell** | Kode-først | Low-code/No-code |
| **Kompleksitetshåndtering** | Full fleksibilitet | Begrensninger ved høy kompleksitet |

**Hovedfunn:**
- Custom-løsningen er implementert med event sourcing, subsidiær logikk og kompleks port-modell som følger NS 8407 nøyaktig
- Power Platform kan håndtere enklere versjoner av funksjonaliteten, men har arkitektoniske begrensninger for de mest komplekse delene
- Valget avhenger av prioritering mellom: full funksjonalitet vs. intern kompetanseutnyttelse

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

### 3.2 Power Platform-alternativ (hypotetisk)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Power Apps                                  │
│              Canvas App eller Model-Driven App                  │
│                                                                 │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │  Skjemaer med forretningsregler                         │  │
│    │  • Dataverse Business Rules                             │  │
│    │  • Power Fx formler                                     │  │
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
│    │  • Integrasjoner (custom connectors)                    │  │
│    └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
      │  Dataverse  │  │   Custom    │  │  Entra ID   │
      │   Tabeller  │  │  Connector  │  │ / External  │
      │             │  │  (Catenda)  │  │     ID      │
      └─────────────┘  └─────────────┘  └─────────────┘
```

**Nøkkelegenskaper:**
- Low-code utvikling med visuell designer
- Innebygd Dataverse-audit trail (ikke event sourcing)
- Godkjenningsflyter med sekvensielle/parallelle trinn
- Premium-lisens kreves for Dataverse og custom connectors

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
- Custom connector krever Premium-lisens for alle brukere
- OAuth 2.0-flyt må konfigureres manuelt
- BCF 3.0-støtte finnes ikke som standard connector
- Webhook-mottak krever HTTP-trigger (også premium)
- Estimert utviklingsarbeid: Betydelig (sammenlign med 2 400+ linjer eksisterende kode)

#### Entra ID / External ID

| Aspekt | Custom | Power Platform |
|--------|--------|----------------|
| Intern SSO | ✅ Entra ID | ✅ Innebygd |
| Eksterne brukere | Magic links + Entra ID | Power Pages + External ID / B2C |
| Fleksibilitet | Høy (magic links 72t) | Middels (krever Microsoft-konto eller B2C) |

**Vurdering:** Power Platform kan gi eksterne tilgang via:
- Azure AD B2C (sunset for nye kunder mai 2025, støttes til 2030)
- Microsoft Entra External ID (nyere, preview for Power Pages feb 2025)
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
- Logger CRUD-operasjoner
- Konfigurerbar retention (90 dager til 1+ år)
- AI-assistert endringssporing
- Kan eksporteres til Azure Synapse Link

**Vurdering:** Event Sourcing gir sterkere garantier for historikk og audit trail, men Dataverse auditing kan være tilstrekkelig for mange formål. Forskjellen er viktigst når:
- Man trenger å rekonstruere tilstand på et gitt tidspunkt
- Man vil "replay" events for debugging/analyse
- Det er juridiske krav til komplett sporbarhet

#### Optimistisk låsing

| Aspekt | Custom | Power Platform |
|--------|--------|----------------|
| Implementasjon | Versjonsnummer per sak | Dataverse RowVersion |
| Konfliktdeteksjon | `expected_version != actual` | ETag / OData-ETag header |
| Konfliktløsning | Klient re-henter og bekrefter | Må implementeres manuelt |

**Vurdering:** Begge plattformer støtter optimistisk låsing, men mekanismene er forskjellige. Custom-løsningen har eksplisitt implementasjon, Power Platform bruker OData-standarder.

### 5.2 Datahåndtering og lagring

#### JSON-håndtering

| Aspekt | Custom | Power Platform |
|--------|--------|----------------|
| Event-data | JSON-payload per event | Multiline Text + ParseJSON |
| Native JSON-kolonne | ✅ (Dataverse/Azure) | ❌ Ikke støttet (2025) |
| Nested objekter | ✅ Full støtte | ⚠️ Må flates ut eller serialiseres |

**Vurdering:** Custom-løsningen lagrer komplekse event-payloads som JSON. Power Platform må enten:
- Serialisere til Multiline Text og parse ved lesing
- Opprette separate tabeller/kolonner for alle felter (denormalisering)

#### Delegering og ytelse

| Aspekt | Custom | Power Platform |
|--------|--------|----------------|
| Maks poster per query | Ubegrenset | 500-2000 (delegation limit) |
| Store datasett | Azure skalering | Krever delegerbare queries |
| Aggregering | Backend-beregning | 50 000 rader maks |

**Estimert volum:** ~1 000 saker/år × 10-15 events/sak = 10 000-15 000 events/år

**Vurdering:** Ved estimert volum (10 000+ events/år) vil delegation limits i Power Apps kunne påvirke:
- Sakliste-visning (må filtreres/pagineres)
- Søk på tvers av alle saker
- Aggregerte rapporter

Dataverse delegerer bedre enn SharePoint, men grensene eksisterer fortsatt.

### 5.3 Skalerbarhet

| Aspekt | Custom | Power Platform |
|--------|--------|----------------|
| **Horisontal skalering** | Azure Functions autoscaling | Ikke relevant (SaaS) |
| **Database** | Dataverse/Azure SQL | Dataverse |
| **API-kall** | Ubegrenset (egen backend) | 2 000-50 000/dag avhengig av lisens |
| **Flow-begrensninger** | N/A | 500 actions per flow |

**Power Automate-begrensninger:**
- Maks 500 actions per flow
- Flyter som throttles 14 dager sammenhengende blir automatisk slått av
- Connector-spesifikke grenser (f.eks. SharePoint: 600 kall/min)

### 5.4 Sikkerhet og tilgangskontroll

| Aspekt | Custom | Power Platform |
|--------|--------|----------------|
| **Autentisering** | Entra ID + Magic Links | Entra ID + External ID/B2C |
| **Autorisasjon** | Rolle-basert (TE/BH) i kode | Dataverse Security Roles |
| **Felt-nivå tilgang** | Implementert i backend | Field Security Profiles |
| **Row-Level Security** | Planlagt (Dataverse) | ✅ Innebygd |

**Vurdering:** Power Platform har modne sikkerhetsfunksjoner via Dataverse. Custom-løsningen implementerer tilsvarende i applikasjonskode, noe som gir mer fleksibilitet men også mer vedlikeholdsansvar.

---

## 6. Ressurs- og kompetansevurdering

### 6.1 Utviklingskompetanse

| Kompetanse | Custom | Power Platform |
|------------|--------|----------------|
| **Primært språk** | TypeScript, Python | Power Fx, konfigurering |
| **Frontend** | React-erfaring | Canvas App designer |
| **Backend** | Python/Node.js | Power Automate, (C# plugins) |
| **Database** | SQL/Dataverse | Dataverse |
| **Læringskurve** | Bratt for low-code erfarne | Bratt for kompleks logikk |

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

### 8.2 Power Platform

| Risiko | Sannsynlighet | Konsekvens | Konsekvens |
|--------|---------------|------------|------------|
| Funksjonelle begrensninger | Høy | Høy | Forenkling eller C# plugins |
| Delegation limits | Middels | Middels | Arkitektur-tilpasning |
| Lisenskostnad-økning | Middels | Middels | Langsiktig avtale |
| Leverandøravhengighet | Lav | Lav | Microsoft er stabil |
| Custom connector-vedlikehold | Middels | Middels | Intern kompetanse |

### 8.3 Juridisk risiko (begge)

Feil i preklusjonslogikk eller subsidiær vurdering kan ha økonomiske konsekvenser. Dette gjelder uavhengig av teknologivalg, men:
- Custom-løsningen har implementert logikken eksplisitt
- Power Platform ville kreve re-implementering med risiko for feil

---

## 9. Usikkerheter som bør undersøkes

Følgende punkter bør avklares før endelig beslutning:

### 9.1 Power Platform-spesifikke

| Tema | Spørsmål | Hvorfor viktig |
|------|----------|----------------|
| **Dataverse-kapasitet** | Hvilken kapasitet er inkludert i eksisterende lisenser? | Påvirker kostnad |
| **Catenda connector** | Det finnes ingen standard connector - må bygges fra scratch (2 400+ linjer i custom-løsningen) | Betydelig utviklingsarbeid |
| **External ID** | Er External ID i produksjon for Power Pages per i dag? | Var i preview feb 2025 |
| **Plugin-kompetanse** | Finnes intern eller tilgjengelig kompetanse på Dataverse C# plugins? | Subsidiær logikk |
| **Delegation i praksis** | Hvordan håndtere 10 000+ events med delegation limits? | Arkitekturvalg |

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
- ✅ Catenda-integrasjon er på plass
- ⚠️ Krever vedlikeholdskompetanse på TypeScript/Python
- ⚠️ Avhengighet av spesifikk teknologikompetanse

**Power Platform-alternativ:**
- ✅ Utnytter eksisterende organisatorisk kompetanse
- ✅ Raskere å gjøre enkle endringer
- ✅ Integrert i Microsoft 365-økosystemet
- ⚠️ Subsidiær logikk vil kreve custom C# utvikling
- ⚠️ Delegation limits kan påvirke store datasett
- ⚠️ Premium-lisensiering for Catenda-integrasjon

### 10.2 Scenariobasert vurdering

| Scenario | Anbefalt tilnærming | Begrunnelse |
|----------|---------------------|-------------|
| Full NS 8407-støtte er kritisk | Custom-løsning | Subsidiær logikk og port-modell er implementert |
| Subsidiær logikk kan forenkles/fjernes | Begge er mulige | Power Platform kan håndtere enklere logikk |
| Minimal ekstern kompetanseavhengighet | Power Platform (med forenklet scope) | Utnytter intern kompetanse |
| Tett Catenda-integrasjon er essensielt | Custom-løsning | 2 400+ linjer ferdig utviklet, testet og validert |
| Rask tid til produksjon | Custom-løsning | Allerede implementert vs. bygge fra scratch |
| Fremtidig datavarehus-integrasjon | Begge bruker Dataverse | Likeverdige på dette punktet |

### 10.3 Hybride alternativer

Det er mulig å kombinere tilnærminger:

1. **Power Platform UI + Custom backend:** Power Apps som frontend, Azure Functions for kompleks logikk
2. **Custom løsning + Power BI:** Bruk eksisterende løsning, koble Power BI for rapportering
3. **Faseinndelt migrering:** Start med custom, evaluer Power Platform for fremtidige moduler

### 10.4 Beslutningsfaktorer

Endelig valg bør baseres på:

1. **Funksjonskrav:** Er subsidiær logikk et må-krav eller nice-to-have?
2. **Kompetansestrategi:** Bygge intern TypeScript/Python-kompetanse eller satse på Power Platform?
3. **Total eierskapskostnad:** Lisenser + utvikling + vedlikehold over 5+ år
4. **Strategisk alignment:** Hvordan passer dette inn i større digitaliseringsstrategi?

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

- Microsoft Learn: Dataverse delegation limits
- Microsoft Learn: Power Automate limits and configuration
- Microsoft Power Platform Blog: Dataverse Auditing (2025)
- Microsoft: Power Apps licensing guide (2024-2025)
- Microsoft: Entra External ID dokumentasjon

### C. Relatert dokumentasjon

- [ARCHITECTURE_AND_DATAMODEL.md](ARCHITECTURE_AND_DATAMODEL.md) - Detaljert arkitekturbeskrivelse
- [DEPLOYMENT.md](DEPLOYMENT.md) - Produksjonsutrulling
- [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) - Sikkerhetslag
