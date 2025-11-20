# Prompt: Migrasjon til Microsoft Stack

## Kontekst

Du er ekspert på Microsoft-stack og skal hjelpe med å gjøre en proof-of-concept løsning produksjonsklar. Løsningen digitaliserer KOE-prosessen (Krav om Endringsordre) for byggeprosjekter etter NS 8407:2011.

---

## Nåværende Arkitektur

### Oversikt

```
┌─────────────────────────────────────────────────────────────┐
│              REACT FRONTEND (GitHub Pages)                   │
│              Punkt Design System (Oslo Kommune)              │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              PYTHON FLASK BACKEND (Lokal)                    │
│              - Webhook-håndtering                            │
│              - PDF-generering                                │
│              - Catenda API-orkestrering                      │
│              - Lokal lagring (CSV + JSON)                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API + Webhooks
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              CATENDA (BIM-plattform)                         │
│              - BCF 3.0 API (topics, comments)                │
│              - v2 API (dokumenter)                           │
│              - Webhooks (issue.created, issue.modified)      │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend (React)

### Teknologier
- **Framework**: React 19.2 + TypeScript
- **UI**: Punkt Design System (@oslokommune/punkt-react)
- **Styling**: Tailwind CSS v4
- **Routing**: React Router v7
- **PDF**: jsPDF + @react-pdf/renderer
- **Hosting**: GitHub Pages (statisk)

### Hovedfiler
```
/App.tsx                    - Hovedkomponent, state management, API-kall
/components/panels/         - GrunninfoPanel, VarselPanel, KravKoePanel, BhSvarPanel
/components/ui/             - Gjenbrukbare komponenter (Field, Toast, etc.)
/services/api.ts            - Backend API-klient
/hooks/useSkjemaData.ts     - State management for komplekse forms
/hooks/useAutoSave.ts       - Autosave til localStorage
/utils/pdfGeneratorReact.tsx - PDF-generering
/types.ts                   - TypeScript interfaces
```

### Datamodell (FormDataModel)
```typescript
interface FormDataModel {
  versjon: string;
  rolle: 'TE' | 'BH';
  sak: {
    sakstittel: string;
    sak_id: string;
    opprettet_av: string;
    opprettet_dato: string;
    prosjekt: string;
    prosjektnummer: string;
    te_navn: string;
    bh_navn: string;
    status: string;
  };
  varsel: {
    dato_forhold_oppdaget: string;
    hovedkategori: string;
    underkategori: string[];
    beskrivelse: string;
    varsel_metode: string;
    dato_varsel_sendt: string;
    vedlegg: Attachment[];
  };
  koe_revisjoner: Koe[];      // Array av krav-revisjoner
  bh_svar_revisjoner: BhSvar[]; // Array av BH-svar
}
```

### API-endepunkter (brukt av frontend)
```typescript
GET  /api/health                    - Helsesjekk
GET  /api/cases/{sakId}?modus=...   - Hent sak
POST /api/varsel-submit             - Send varsel
POST /api/koe-submit                - Send krav
POST /api/svar-submit               - Send BH-svar
POST /api/cases/{sakId}/pdf         - Last opp PDF
PUT  /api/cases/{sakId}/draft       - Lagre utkast
```

---

## Backend (Python Flask)

### Teknologier
- **Framework**: Flask 2.x
- **Auth**: OAuth 2.0 (Client Credentials)
- **Lagring**: CSV + JSON filer (lokal)
- **PDF**: Mottar Base64 fra frontend
- **Logging**: Python logging til fil

### Hovedfiler
```
/backend/app.py              - Flask app, endpoints, KOEAutomationSystem
/backend/catenda_api_tester.py - Catenda API-klient (full BCF 3.0 + v2 support)
```

### Klasser

**DataManager** - Lokal datahåndtering
```python
class DataManager:
    def __init__(self, data_dir='data'):
        self.saker_file = 'saker.csv'
        self.historikk_file = 'historikk.csv'
        self.form_data_dir = 'form_data/'  # JSON per sak

    def save_sak(self, sak_data: dict)
    def get_sak(self, sak_id: str) -> dict
    def save_form_data(self, sak_id: str, data: dict)
    def load_form_data(self, sak_id: str) -> dict
    def add_historikk(self, sak_id: str, hendelse: str, beskrivelse: str)
```

**KOEAutomationSystem** - Forretningslogikk
```python
class KOEAutomationSystem:
    def __init__(self, config: dict):
        self.catenda = CatendaAPITester(config)
        self.data_manager = DataManager()

    def handle_new_topic_created(self, payload: dict)  # Webhook: ny sak
    def handle_topic_modification(self, payload: dict) # Webhook: endring
    def handle_varsel_submit(self, sak_id, form_data, topic_guid)
    def handle_koe_submit(self, sak_id, form_data, topic_guid)
    def handle_svar_submit(self, sak_id, form_data, topic_guid)
    def handle_pdf_upload(self, sak_id, pdf_base64, filename, topic_guid)
```

**CatendaAPITester** - API-klient
```python
class CatendaAPITester:
    def __init__(self, config):
        self.base_url = "https://api.catenda.com"
        self.client_id = config['catenda_client_id']
        self.client_secret = config['catenda_client_secret']

    # Autentisering
    def authenticate(self) -> bool  # Client credentials grant
    def set_access_token(self, token, expires_in)

    # BCF 3.0 API
    def get_topic_boards(self, project_id) -> list
    def get_topics(self, board_id) -> list
    def get_topic(self, board_id, topic_guid) -> dict
    def create_comment(self, topic_guid, comment_text) -> dict
    def create_document_reference(self, topic_guid, doc_guid) -> dict

    # v2 API
    def get_document_libraries(self, project_id) -> list
    def upload_document(self, project_id, file_path, filename) -> dict
```

### Konfiguration (config.json)
```json
{
  "catenda_client_id": "...",
  "catenda_client_secret": "...",
  "catenda_project_id": "...",
  "react_app_url": "https://...",
  "default_library_id": "..."
}
```

---

## Catenda-integrasjon

### Webhooks (mottas av backend)

**Endpoint**: `POST /webhook/catenda`

**Events som håndteres**:
```python
'issue.created' / 'bcf.issue.created'  → handle_new_topic_created()
'issue.modified' / 'bcf.comment.created' → handle_topic_modification()
```

**Payload-eksempel (issue.created)**:
```json
{
  "event": {"type": "issue.created"},
  "data": {
    "topic": {
      "guid": "abc123...",
      "title": "Endring av støyskjerm",
      "project_id": "xyz789..."
    }
  }
}
```

### API-kall til Catenda

**1. Autentisering (OAuth 2.0 Client Credentials)**
```
POST https://api.catenda.com/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={id}
&client_secret={secret}

Response: { "access_token": "...", "expires_in": 3600 }
```

**2. Hent topic boards (BCF 3.0)**
```
GET https://api.catenda.com/opencde/bcf/3.0/projects
Authorization: Bearer {token}

Response: [{ "project_id": "...", "name": "..." }]
```

**3. Opprett kommentar (BCF 3.0)**
```
POST https://api.catenda.com/opencde/bcf/3.0/projects/{board_id}/topics/{topic_guid}/comments
Authorization: Bearer {token}
Content-Type: application/json

{ "comment": "Melding her..." }
```

**4. Last opp dokument (v2 API)**
```
POST https://api.catenda.com/v2/projects/{project_id}/libraries/{library_id}/items
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: (binary)
name: "KOE-2024-001.pdf"

Response: { "id": "compact-guid-32-chars" }
```

**5. Opprett document reference (BCF 3.0)**
```
POST https://api.catenda.com/opencde/bcf/3.0/projects/{board_id}/topics/{topic_guid}/document_references
Authorization: Bearer {token}
Content-Type: application/json

{ "document_guid": "formatted-guid-36-chars" }
```

**VIKTIG: GUID-konvertering**
```python
# v2 API returnerer kompakt GUID (32 tegn)
compact = "abc123def456..."

# BCF API krever standard UUID-format (36 tegn)
formatted = f"{compact[:8]}-{compact[8:12]}-{compact[12:16]}-{compact[16:20]}-{compact[20:]}"
# → "abc123de-f456-..."
```

---

## Arbeidsflyt

### Hovedflyt

1. **Entreprenør oppretter sak i Catenda** (topic)
   - Catenda sender webhook `issue.created`
   - Backend mottar, oppretter lokal sak, poster kommentar med lenke

2. **Entreprenør fyller ut varsel**
   - Åpner lenke med `?sakId={id}&modus=varsel`
   - Fyller ut skjema, klikker Send
   - Frontend kaller `POST /api/varsel-submit`
   - Backend oppdaterer status, poster kommentar til Catenda

3. **Entreprenør fyller ut krav (KOE)**
   - Fortsetter til Krav-fanen
   - Fyller ut vederlag/fristforlengelse
   - Klikker Send
   - Frontend genererer PDF, sender til backend
   - Backend laster opp PDF til Catenda, poster kommentar

4. **Byggherre svarer**
   - Åpner samme lenke (systemet vet det er BH sin tur)
   - Fyller ut svar (godkjent/avslått/delvis)
   - Klikker Send
   - Backend oppdaterer, poster kommentar

5. **Eventuell revidering**
   - Entreprenør kan sende revidert krav
   - Prosessen gjentas til enighet

### Statuser

**Sak-status**:
- `100000000` - Under varsling
- `100000002` - Venter på svar
- `100000003` - Under avklaring
- `100000005` - Omforent (EO utstedes)
- `100000011` - Lukket (Implementert)

**KOE-status**:
- `100000001` - Utkast
- `100000002` - Sendt til BH
- `200000001` - Besvart

**BH Svar-status**:
- `300000001` - Utkast
- `100000004` - Godkjent
- `300000002` - Delvis godkjent
- `100000006` - Avslått

---

## Produksjonskrav

### Autentisering
- **Nåværende**: Ingen (åpen API)
- **Produksjon**: Entra ID (Azure AD) for brukertilgang

### Lagring
- **Nåværende**: Lokal CSV + JSON
- **Produksjon**: Database (Dataverse? Azure SQL? Cosmos DB?)

### Hosting
- **Frontend**: GitHub Pages → Azure Static Web Apps?
- **Backend**: Lokal Flask → Azure Functions? App Service? Logic Apps?

### Sikkerhet
- Webhook-signatur validering
- Token-refresh automatikk
- Rate limiting
- Audit trail

---

## Spørsmål til MS Stack-ekspert

1. **Backend-migrering**:
   - Azure Functions vs App Service vs Logic Apps for denne typen orkestrering?
   - Hvordan håndtere webhooks i Azure?
   - Beste praksis for OAuth 2.0 token-håndtering i Azure?

2. **Datalagring**:
   - Dataverse vs Azure SQL vs Cosmos DB for skjemadata?
   - Hvordan strukturere for revisjonshistorikk?

3. **Frontend-hosting**:
   - Azure Static Web Apps med Entra ID-autentisering?
   - Hvordan integrere med backend?

4. **Integrasjon**:
   - Beholde direkte Catenda API-kall eller bruke Logic Apps?
   - Hvordan håndtere PDF-generering i serverless?

5. **Sikkerhet**:
   - Entra ID-oppsett for TE/BH-roller?
   - Managed Identity for Catenda API-tilgang?

6. **DevOps**:
   - CI/CD pipeline for frontend + backend?
   - Miljøer (dev/test/prod)?

---

## Vedlegg

Se `/docs/KOE_FORBEDRINGSRAPPORT.md` for detaljert vurdering av forbedringsbehov i nåværende løsning.
