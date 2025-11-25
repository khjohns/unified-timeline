# Overordnet Design (HLD)
# Digital Samhandlingsplattform for Byggeprosjekter

**Oslobygg KF**
**Dato:** November 2025
**Versjon:** 1.0 (Utkast)

---

## Innholdsfortegnelse

1. [Arkitektur/Forretningslandskap](#1-arkitekturforretningslandskap)
2. [Scope/Prioritet](#2-scopeprioritet)
3. [Formål og begrunnelse](#3-formål-og-begrunnelse)
4. [Arkitekturdiagram](#4-arkitekturdiagram)
5. [Komponentbeskrivelse](#5-komponentbeskrivelse)
6. [Datamodell](#6-datamodell)
7. [Integrasjoner](#7-integrasjoner)
8. [Verdivurdering](#8-verdivurdering)
9. [Persondata](#9-persondata)
10. [Risikovurdering](#10-risikovurdering)
11. [Tidslinje](#11-tidslinje)
12. [Vedlegg](#12-vedlegg)

---

## 1. Arkitektur/Forretningslandskap

*[Denne seksjonen fylles ut med kontekstdiagram som viser plassering i Oslobyggs applikasjonslandskap]*

---

## 2. Scope/Prioritet

*[Denne seksjonen fylles ut med prosjektets omfang og prioritering]*

---

## 3. Formål og begrunnelse

### 3.1 Bakgrunn

Prosjektet er initiert av **Oslobygg KF** for å modernisere og digitalisere samhandlingsprosesser i byggeprosjekter. Dagens prosesser for håndtering av fravik og endringsordrer foregår via e-post og Word-maler, med PDF-vedlegg som sendes frem og tilbake mellom partene. All dokumentasjon arkiveres manuelt i Catenda (prosjektinformasjonsmodell-system).

### 3.2 Problemstilling

Dagens situasjon medfører flere utfordringer:

#### Datatap
Informasjonen blir innelåst i PDF-format, noe som betyr at dataene ikke kan søkes, sorteres eller analyseres automatisk. Når data ligger i PDF-filer kan vi ikke rapportere på tvers av prosjekter eller aggregere informasjon for å få helhetlig innsikt i organisasjonen.

#### Ineffektivitet
- Prosjektledere bruker tid på å flytte filer mellom systemer manuelt
- Behandlingstiden for en typisk søknad er 5-7 dager
- Det skjer ofte dobbeltregistrering fordi samme informasjon må skrives inn på flere steder

#### Høy terskel
Leverandører sliter med å få tilgang til portaler og faller tilbake på e-post som kommunikasjonsform, noe som skaper mer manuelt arbeid.

### 3.3 Målsetting

Prosjektet skal levere:

- **Strukturerte data** - informasjon som ligger i databaser hvor hvert datafelt har sin plass (ikke innelåst i PDF-filer)
- **Lav terskel** for eksterne brukere - enkelt å komme i gang uten kompliserte innloggingsprosesser
- **Automatisk arkivering** - dokumenter lagres riktig sted uten manuell håndtering
- **Sikker samhandling** - trygg deling av informasjon mellom parter
- **Skalerbart** til 50+ prosjekter - løsningen må fungere like godt om vi har 5 eller 50 prosjekter

### 3.4 Pilot-applikasjoner

Løsningen implementeres først med to pilot-applikasjoner:

#### 1. Fravik utslippsfri byggeplass
En leverandør søker om unntak fra miljøkrav (f.eks. bruk av dieselekskovator i stedet for elektrisk, eller arbeid som gir støy). En rådgiver vurderer søknaden faglig, og prosjektleder fatter endelig vedtak.

**Klassifisering:** Lav risiko (ingen økonomiske konsekvenser, ikke juridisk bindende)

#### 2. Krav om Endringsordre (KOE)
En prosess som starter med varsel om et forhold (f.eks. endrede tegninger), utvikler seg til et krav om endring, mottar svar fra byggherre, og ender i en kontraktsendring med økonomisk konsekvens.

**Klassifisering:** Høy risiko (store økonomiske konsekvenser, kontraktsbindende)

### 3.5 Forventede gevinster

#### Datadrevet beslutningstaking
- Strukturerte data muliggjør rapportering på tvers av prosjekter
- Mulighet for analyse av mønstre, trender og flaskehalser
- Grunnlag for kontinuerlig forbedring

#### Effektivisering
- Redusert behandlingstid fra 5-7 dager til estimert 1-2 dager
- Automatisk arkivering eliminerer manuell filhåndtering
- Ingen dobbeltregistrering av data

#### Bedre brukeropplevelse
- Lav terskel for eksterne leverandører
- Intuitiv brukerflate basert på Oslo kommunes designsystem (Punkt)
- Tilgjengelig fra mobil, nettbrett og desktop

#### Juridisk sporbarhet
- Komplett audit trail for alle handlinger
- Immutable (uforanderlig) saksgrunnlag
- Dokumentert beslutningsforløp

---

## 4. Arkitekturdiagram

### 4.1 POC-arkitektur (Prototype)

Prototypen ble utviklet for å validere konseptet og brukeropplevelsen.

```
┌─────────────────┐     Webhook      ┌─────────────────┐
│     Catenda     │ ───────────────> │  Python Backend │
│   (Prosjekt-    │                  │   (Flask:8080)  │
│    hotell)      │ <─────────────── │                 │
└─────────────────┘   API (comment,  └────────┬────────┘
                      document)               │ REST API
                                              │
                      ┌───────────────────────┼───────────────────────┐
                      │                       ▼                       │
                      │              ┌─────────────────┐              │
                      │              │   React App     │              │
                      │              │ (GitHub Pages)  │              │
                      │              └─────────────────┘              │
                      │                                               │
                      │  URL: ?sakId={guid}&modus={varsel|koe|svar}   │
                      └───────────────────────────────────────────────┘

                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │   CSV/JSON       │
                                    │   (lokal disk)   │
                                    └──────────────────┘
```

**Hovedkomponenter:**
- React-applikasjon hostet på GitHub Pages
- Python Flask backend (port 8080)
- CSV-basert datalagring
- Catenda webhook og API-integrasjon

**Begrensninger:**
- Ikke skalerbart (CSV-filer)
- Ingen integrert sikkerhet
- Manuell drift og backup

### 4.2 L1D Produksjonsarkitektur

Produksjonsløsningen bygger på Azure-plattformen med fokus på skalerbarhet, sikkerhet og vedlikeholdbarhet.

```
                                    ┌──────────────────┐
                                    │    Bruker        │
                                    │  (Ekstern/       │
                                    │   Intern)        │
                                    └────────┬─────────┘
                                             │
                                             ▼
                              ┌──────────────────────────────┐
                              │  Azure Front Door + WAF      │
                              │  - DDoS Protection           │
                              │  - Rate Limiting             │
                              │  - Geo-filtering             │
                              └──────────────┬───────────────┘
                                             │
                                             ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    Azure Static Web Apps                              │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                     React Frontend                              │  │
│  │  - React 19 + TypeScript                                        │  │
│  │  - Punkt (Oslo kommunes designsystem)                           │  │
│  │  - Client-side PDF-generering (@react-pdf)                      │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │ HTTPS/REST
                                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│                      Azure Functions (Python 3.11)                    │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Forretningslogikk og API-lag                                    │ │
│  │  - Gatekeeper (autorisasjon)                                     │ │
│  │  - Validering (input/output)                                     │ │
│  │  - Magic Link-håndtering                                         │ │
│  │  - Webhook-mottak fra Catenda                                    │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───────────────┬───────────────────────────────────┬───────────────────┘
                │                                   │
                │ Managed Identity                  │ HTTPS
                ▼                                   ▼
┌───────────────────────────┐        ┌──────────────────────────────┐
│      Dataverse            │        │         Catenda              │
│  ┌─────────────────────┐  │        │  ┌────────────────────────┐  │
│  │  - Applications     │  │        │  │  - Webhook (inn)       │  │
│  │  - Projects         │  │        │  │  - Document API v2     │  │
│  │  - AuditLog         │  │        │  │  - BCF 3.0 API         │  │
│  │  - MagicLinks       │  │        │  │  - Project Members     │  │
│  └─────────────────────┘  │        │  └────────────────────────┘  │
│  Row-Level Security       │        │  Autoritativ dokument-kilde  │
└───────────────────────────┘        └──────────────────────────────┘
                │
                │ Native Connector
                ▼
┌───────────────────────────┐
│      Power BI             │
│  - Rapporter              │
│  - Dashboards             │
│  - Analyse                │
└───────────────────────────┘

        ┌──────────────────────────────────────┐
        │  Microsoft 365 Økosystem             │
        │  ┌────────────────────────────────┐  │
        │  │  Entra ID (SSO, MFA)           │  │
        │  │  SharePoint (vedlegg)          │  │
        │  │  Microsoft Graph API           │  │
        │  └────────────────────────────────┘  │
        └──────────────────────────────────────┘
```

**Sikkerhetsflyt (5 lag):**

1. **Nettverk:** Azure Front Door med WAF, DDoS Protection, Rate Limiting
2. **Autentisering:** Catenda/Entra ID/Magic Link
3. **Autorisasjon:** Azure Functions Gatekeeper (UUID, TTL, scope)
4. **Data:** Dataverse Row-Level Security, Managed Identity
5. **Observerbarhet:** Application Insights, Azure Monitor Alerts

### 4.3 Dataflyt: Typisk brukerscenario

**Scenario: Entreprenør sender Krav om Endringsordre (KOE)**

```
1. Catenda: Prosjektleder oppretter ny sak
   │
   ├─> Catenda sender webhook til Azure Functions
   │
2. Azure Functions: Mottar webhook
   │
   ├─> Validerer signatur (HMAC)
   ├─> Sjekker idempotens (duplikatsjekk)
   ├─> Oppretter sak i Dataverse
   ├─> Genererer Magic Link (UUID v4)
   │
   └─> Poster lenke tilbake til Catenda-saken
       │
3. Entreprenør: Klikker lenke i Catenda
   │
   ├─> Azure Functions validerer UUID (gyldig? utløpt?)
   ├─> Henter forhåndsutfylt prosjektdata fra Dataverse
   │
   └─> React App: Viser skjema med prosjektinfo
       │
4. Entreprenør: Fyller ut KOE-skjema
   │
   ├─> React genererer PDF-preview i sanntid (client-side)
   ├─> Entreprenør bekrefter e-post (JIT-validering mot Catenda)
   │
   └─> Sender inn: POST /api/koe-submit
       │
5. Azure Functions: Mottar innsending
   │
   ├─> Validerer prosjekt-scope og rolle
   ├─> Lagrer strukturert data i Dataverse
   ├─> Lagrer audit log-entry
   │
   └─> Returnerer sakId til React
       │
6. React App: Sender PDF
   │
   └─> POST /api/cases/{sakId}/pdf (base64)
       │
7. Azure Functions: Mottar PDF
   │
   ├─> Laster opp til Catenda Document Library (v2 API)
   ├─> Konverterer compact GUID til UUID-36
   ├─> Oppretter BCF document reference
   ├─> Poster kommentar til Catenda: "KOE mottatt - PDF vedlagt"
   │
   └─> Returnerer suksess til bruker
       │
8. Prosjektleder: Logger inn via Entra ID (SSO)
   │
   ├─> Åpner saksbehandlingsmodus
   ├─> Ser søknad (Fane 1 - read-only)
   ├─> Fyller ut behandling (Fane 2 - editable)
   │
   └─> Sender svar → ny PDF → Catenda
```

---

## 5. Komponentbeskrivelse

### 5.1 Frontend (React App)

#### Teknologier

| Teknologi | Versjon | Formål |
|-----------|---------|--------|
| **React** | 19 | UI-rammeverk for komponentbasert utvikling |
| **TypeScript** | 5.x | Typesikkerhet og bedre utvikleropplevelse |
| **Vite** | Latest | Byggverktøy og development server |
| **Punkt** | Latest | Oslo kommunes designsystem (komponenter, farger, typografi) |
| **Tailwind CSS** | 3.x | Utility-first CSS for rask styling |
| **@react-pdf/renderer** | Latest | Client-side PDF-generering |
| **React Router** | 6.x | Navigasjon og URL-håndtering |

#### Ansvarsområder

**Brukergrensesnitt:**
- Responsivt design som fungerer på mobil, nettbrett og desktop
- WCAG 2.1 AA-kompatibel (universell utforming)
- Konsistent med Oslo kommunes visuelle profil

**Skjemahåndtering:**
- Dynamiske skjema med valideringer
- Real-time PDF-preview mens brukeren fyller ut
- Autosave av utkast (draft mode)

**PDF-generering:**
- Client-side rendering for å spare servekostnader
- Bruk av Oslo Sans font (kommunal profil)
- Strukturert layout med seksjoner og signaturfelt

**API-kommunikasjon:**
- REST API-kall til Azure Functions
- Error handling og retry-logikk
- Loading states og brukerrespons

#### Deployment

**POC:**
- Hostet på GitHub Pages
- Manuell deploy ved git push

**L1D (Produksjon):**
- Azure Static Web Apps
- CI/CD via GitHub Actions
- Automatisk deployment ved merge til main branch

---

### 5.2 Backend (Azure Functions)

#### Teknologier

| Teknologi | Formål |
|-----------|--------|
| **Python 3.11** | Programmeringsspråk |
| **Azure Functions** | Serverless compute platform |
| **Consumption Plan** | Betal-per-bruk, automatisk skalering |
| **Dataverse SDK** | Integrasjon mot Dataverse |
| **Requests** | HTTP-klient for Catenda API-kall |
| **PyJWT** | JWT-håndtering for autentisering |
| **Pydantic** | Datavalidering og serialisering |

#### Ansvarsområder

**Sikkerhet (Gatekeeper-pattern):**
```python
# Pseudokode: Gatekeeper-funksjon
def gatekeeper(request, required_role=None):
    """
    Validerer alle innkommende forespørsler før de når forretningslogikk.
    """
    # 1. Hent token fra request (URL parameter eller header)
    token = extract_token(request)

    # 2. Valider UUID format
    if not is_valid_uuid(token):
        return 400, "Invalid token format"

    # 3. Hent Magic Link fra database
    magic_link = dataverse.get_magic_link(token)

    if not magic_link:
        return 403, "Token not found"

    # 4. Sjekk TTL (Time To Live)
    if magic_link.expires_at < datetime.now():
        return 403, "Token expired"

    # 5. Sjekk one-time token
    if magic_link.used:
        log_suspicious_activity(token, request.ip)
        return 403, "Token already used"

    # 6. Sjekk prosjekt-scope
    if magic_link.project_id != request.data.get("project_id"):
        return 403, "Project mismatch"

    # 7. Valider rolle (hvis påkrevd)
    if required_role and magic_link.role != required_role:
        return 403, f"Role {required_role} required"

    # 8. Marker token som brukt (for one-time tokens)
    if magic_link.single_use:
        dataverse.mark_used(token)

    # 9. Logg hendelse til audit log
    audit_log(token, "access_granted", request.ip)

    return magic_link  # Godkjent, returner kontekst
```

**API-endepunkter:**

| Endepunkt | Metode | Beskrivelse | Autentisering |
|-----------|--------|-------------|---------------|
| `/api/health` | GET | Health check | Ingen |
| `/api/cases/{sakId}` | GET | Hent sak | Magic Link eller Entra ID |
| `/api/varsel-submit` | POST | Send varsel | Magic Link |
| `/api/koe-submit` | POST | Send KOE | Magic Link + e-postvalidering |
| `/api/svar-submit` | POST | Send BH-svar | Entra ID (kun PL) |
| `/api/cases/{sakId}/revidering` | POST | Send revisjon | Magic Link |
| `/api/cases/{sakId}/pdf` | POST | Last opp PDF | Magic Link eller Entra ID |
| `/api/cases/{sakId}/draft` | PUT | Lagre utkast | Magic Link eller Entra ID |
| `/api/link-generator` | POST | Generer Magic Link | Entra ID (kun PL) |
| `/webhook/catenda` | POST | Catenda webhook | HMAC-signatur |

**Dataverse-operasjoner:**
- CRUD (Create, Read, Update, Delete) for Applications, Projects, AuditLog
- Managed Identity for sikker tilkobling (ingen lagrede credentials)
- Retry-logikk med exponential backoff ved throttling

**Catenda-integrasjon:**
- Webhook-mottak med signaturvalidering
- Document upload via v2 API
- BCF 3.0 document references
- Kommentar-posting til topics
- JIT-validering av Project Members

**Observerbarhet:**
- Strukturert logging til Application Insights
- Custom metrics for business events
- Alert-triggere ved mistenkelig aktivitet

---

### 5.3 Database (Dataverse)

#### Hvorfor Dataverse?

**Fordeler over SharePoint:**
- Ingen 5000-grense på listevisninger
- Native row-level security for interne brukere
- Bedre ytelse ved høyt datavolum
- Native Power BI connector
- Cloud-native skalerbarhet

**Fordeler over SQL Database:**
- Innebygd sikkerhet og auditlogging
- Ingen infrastruktur å administrere
- Integrasjon med Power Platform
- Forhåndsdefinerte datatyper og relasjoner

#### Datamodell (foreløpig)

**Applications (Søknader/Krav):**
- `application_id` (Primary Key, GUID)
- `project_id` (Foreign Key → Projects)
- `case_type` (fravik | koe)
- `status` (draft | submitted | under_review | approved | rejected | closed)
- `form_data` (JSON - strukturert skjemadata)
- `created_by` (tekst - navn eller Entra ID)
- `created_at` (DateTime)
- `submitted_at` (DateTime)
- `reviewed_by` (Entra ID)
- `reviewed_at` (DateTime)
- `catenda_topic_guid` (tekst)
- `catenda_document_guid` (tekst)

**Projects (Prosjekter):**
- `project_id` (Primary Key, GUID)
- `project_name` (tekst)
- `catenda_project_id` (tekst)
- `project_leader` (Entra ID)
- `start_date` (DateTime)
- `end_date` (DateTime)
- `status` (active | completed | archived)

**MagicLinks (Token-håndtering):**
- `token` (Primary Key, UUID v4)
- `application_id` (Foreign Key → Applications)
- `project_id` (Foreign Key → Projects)
- `recipient_email` (tekst)
- `role` (TE | BH | Advisor | PL)
- `created_at` (DateTime)
- `expires_at` (DateTime)
- `used` (Boolean)
- `used_at` (DateTime)
- `used_by_ip` (tekst)
- `single_use` (Boolean)
- `revoked` (Boolean)
- `revoked_reason` (tekst)

**AuditLog (Revisjonslogg):**
- `audit_id` (Primary Key, GUID)
- `timestamp` (DateTime)
- `event_type` (login | link_use | submit | sign | jit_role | webhook_received, ...)
- `user_id` (Entra ID eller selvdeklarert)
- `application_id` (Foreign Key, nullable)
- `project_id` (Foreign Key, nullable)
- `ip_address` (tekst)
- `user_agent` (tekst)
- `details` (JSON - event-spesifikk metadata)
- `result` (success | failure | suspicious)

#### Sikkerhet

**Row-Level Security (RLS) for interne brukere:**
- Prosjektledere ser kun søknader for sine egne prosjekter
- Administratorer ser alle søknader
- Implementeres via Dataverse Security Roles

**Server-side filtering for eksterne (Magic Link):**
- RLS gjelder kun Entra ID-brukere
- Eksterne (Magic Link) får tilgang via API-lag
- Azure Functions håndhever prosjekt-scope og felttilgang

```python
# Pseudokode: Server-side autorisasjon
def get_application(app_id, scope_project, role):
    app = dataverse.get(app_id)

    # Prosjekt-scope
    if app.project_id != scope_project:
        return 403, "Project mismatch"

    # Rolle-basert felttilgang
    if role == "TE":
        # Entreprenør ser kun TE-felt og sak-info
        return filter_fields(app, allowed=["case_info", "te_fields"])

    elif role == "BH":
        # Byggherre ser alt, kan skrive BH-felt
        return filter_fields(app, allowed=["case_info", "te_fields", "bh_fields"])

    elif role == "PL":
        # Prosjektleder ser alt
        return app

    return 403, "Unauthorized"
```

---

### 5.4 Eksterne systemer

#### Catenda (PIM-system)

**Rolle:** Autoritativ kilde for prosjektdokumenter og samarbeidsdata.

**Integrasjoner:**

1. **Webhook (innkommende):**
   - Event: `topic.created`
   - Trigger: Ny sak opprettes i Catenda
   - Action: Azure Functions genererer Magic Link og poster tilbake

2. **Document API v2 (utgående):**
   - Opplasting av PDF-filer til Document Library
   - Returnerer compact GUID (32 tegn)

3. **BCF 3.0 API (utgående):**
   - Opprette document references på topics
   - Krever UUID format (36 tegn) - konvertering nødvendig
   - Poste kommentarer til topics

4. **Project Members API (utgående):**
   - Hente liste over prosjektdeltakere
   - JIT-validering av entreprenør e-post ved KOE-innsending
   - Brukes i Link Generator for å populere mottakerliste

**Webhook-sikkerhet:**
- HMAC-signaturvalidering (`x-catenda-signature`)
- Delt hemmelighet lagres i Azure Key Vault
- Idempotens: Samme event behandles ikke to ganger

#### Microsoft 365

**Entra ID (Azure AD):**
- Single Sign-On for interne brukere
- Multi-Factor Authentication (MFA)
- Conditional Access policies
- Managed Identity for service-to-service auth

**SharePoint:**
- Vedleggslagring via Microsoft Graph API
- Resumable upload for store filer (< 250 MB)
- Prosjektspesifikke dokumentbiblioteker

**Power BI:**
- Native Dataverse connector
- Rapporter og dashboards
- Analyse på tvers av prosjekter

---

### 5.5 Teknologivalg og begrunnelser

#### L1D over L4 (Power Pages)

**Vurderte alternativer:**
- **L4:** Power Pages med React SPA
- **L1D:** Custom React + Dataverse + Azure Functions

**Valgt løsning:** L1D

**Begrunnelse:**

| Kriterium | L4 (Power Pages) | L1D (Custom React) | Vinner |
|-----------|------------------|---------------------|--------|
| **Sikkerhet** | GUI-konfigurasjon (implisitt, risiko for feil) | Code-first (eksplisitt, versjonert) | **L1D** |
| **Fleksibilitet** | Begrenset av Power Pages-rammeverket | Full kontroll over UX og logikk | **L1D** |
| **Testbarhet** | Manuell testing, vanskelig å automatisere | Unit tests, integration tests, E2E | **L1D** |
| **Kostnad** | Lisenskostnad per ekstern bruker | Serverless (betal-per-bruk) | **L1D** |
| **Vedlikeholdbarhet** | Konfigurasjon spredt i GUI | Kode i Git, code review, CI/CD | **L1D** |
| **UX-kontroll** | Begrenset tilpasning | Fullstendig kontroll (Punkt) | **L1D** |

**Konklusjon:** L1D gir bedre kontroll over sikkerhet, brukeropplevelse og vedlikeholdbarhet, til tross for høyere initiale utviklingskostnader.

---

