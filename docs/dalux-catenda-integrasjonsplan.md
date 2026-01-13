# Integrasjonsplan: Dalux → Catenda

## Sammendrag

Denne planen beskriver en enveis-integrasjon fra Dalux Build til Catenda, der tasks og dokumenter fra entreprenørens Dalux-prosjekt synkroniseres til byggherrens Catenda-prosjekt.

## Bakgrunn og formål

| Aspekt | Beskrivelse |
|--------|-------------|
| **Hvem** | Byggherre tilbyr integrasjonstjeneste, entreprenør er Dalux-kunde |
| **Hvorfor** | Sømløs opplevelse for entreprenør - unngå dobbeltregistrering |
| **Ansvar** | Entreprenør er kontraktuelt ansvarlig for at data finnes i Catenda |
| **Fallback** | Ved synk-feil må entreprenør manuelt legge inn i Catenda |

## Autentisering og tilgang

### Dalux API-nøkkel (per prosjekt)

```
Entreprenør (Dalux-kunde):
1. Firmaadministrator oppretter API-identitet
2. Gir prosjektnivå-tilgang med passende brukergruppe
3. Genererer API-nøkkel med utløpsdato
4. Deler nøkkel sikkert med byggherre

Byggherre:
1. Lagrer nøkkel i prosjektkonfigurasjon
2. Aktiverer synk for prosjektet
```

### Viktig tidsfrist

Gamle Dalux API-nøkler utløper **28. februar 2026** - alle må over på API-identiteter.

---

## Teknisk arkitektur

### Overordnet flyt

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│   Dalux Build   │  poll   │   Unified Timeline   │  push   │    Catenda      │
│                 │ ──────▶ │    (synk-tjeneste)   │ ──────▶ │                 │
│  - Tasks        │         │                      │         │  - BCF Topics   │
│  - Attachments  │         │  - Polling-scheduler │         │  - Documents    │
│  - Files        │         │  - Mapping-logikk    │         │  - Comments     │
└─────────────────┘         │  - Konflikt-håndtering│        └─────────────────┘
                            └──────────────────────┘
```

### Begrensninger

| Retning | Status | Kommentar |
|---------|--------|-----------|
| Dalux → Catenda | ✅ Mulig | Dalux API har full lesetilgang |
| Catenda → Dalux | ❌ Ikke mulig | Dalux API har ingen skrivetilgang på tasks |

---

## Dalux API - Relevante endepunkter

### Autentisering

```http
Header: X-API-KEY: {api_nøkkel}
```

### Base URL

Base URL er **kundespesifikk** og må fås fra Dalux support. URL-strukturen følger mønsteret:

```
https://{node}.field.dalux.com/service/api/{versjon}/{endepunkt}
```

| Komponent | Beskrivelse | Eksempel |
|-----------|-------------|----------|
| `{node}` | Kundespesifikk server (node1, node2, etc.) | `node1` |
| `{versjon}` | API-versjon (varierer per endepunkt) | `5.1` |
| `{endepunkt}` | Ressursen som hentes | `projects` |

**For dette prosjektet (Stovner skole):**
```
Base URL: https://node1.field.dalux.com/service/api/
```

> **Viktig:** Kontakt support@dalux.com for å få riktig base URL for din organisasjon.

### Verifisert eksempel: Hent prosjekter

**Request:**
```http
GET https://node1.field.dalux.com/service/api/5.1/projects HTTP/1.1
Host: node1.field.dalux.com
X-API-KEY: {din_api_nøkkel}
User-Agent: SwaggerHub-Explore/2.2.0
Connection: keep-alive
```

**Response (200 OK):**
```json
{
  "items": [
    {
      "data": {
        "projectId": "6070718657",
        "projectName": "Stovner skole"
      }
    }
  ],
  "metadata": {
    "totalItems": 1,
    "totalRemainingItems": 1
  },
  "links": [
    {
      "rel": "self",
      "href": "https://node1.field.dalux.com/service/api/5.1/projects",
      "method": "GET"
    }
  ]
}
```

> **Merk:** Dette er fra Dalux Field API. Responsen følger HATEOAS-mønster med `links` for navigasjon.

### Tasks og saker

| Endepunkt | Beskrivelse | Bruk |
|-----------|-------------|------|
| `GET /5.2/projects/{projectId}/tasks` | Alle tasks, approvals, safety issues | Initial synk |
| `GET /2.3/projects/{projectId}/tasks/changes` | Kun endringer siden sist | Inkrementell synk |
| `GET /3.4/projects/{projectId}/tasks/{taskId}` | Enkelt task med detaljer | Ved behov |
| `GET /1.1/projects/{projectId}/tasks/attachments` | Vedlegg på tasks | Dokumentsynk |

### Filer og dokumenter

| Endepunkt | Beskrivelse |
|-----------|-------------|
| `GET /5.1/projects/{projectId}/file_areas` | Liste filområder |
| `GET /6.0/projects/{projectId}/file_areas/{id}/files` | Liste filer (inkrementell) |
| `GET /2.0/.../files/{id}/revisions/{rev}/content` | Last ned filinnhold |

---

## Datamodell-mapping

### Dalux Task → Catenda BCF Topic

| Dalux (ApiTaskGet) | Catenda (BCF Topic) | Kommentar |
|--------------------|---------------------|-----------|
| `taskId` | `guid` | Lagres som ekstern referanse |
| `title` | `title` | Direkte mapping |
| `description` | `description` | Direkte mapping |
| `type` | `topic_type` | Mapping-tabell (se under) |
| `status` | `topic_status` | Mapping-tabell (se under) |
| `assignedTo.email` | `assigned_to` | E-post som identifikator |
| `createdBy.email` | `creation_author` | E-post som identifikator |
| `created` | `creation_date` | ISO 8601 datoformat |
| `deadline` | `due_date` | ISO 8601 datoformat |
| `userDefinedFields` | `labels` / `description` | Tilpasset per prosjekt |

### Type-mapping

| Dalux type | Catenda topic_type |
|------------|-------------------|
| `task` | `Task` |
| `approval` | `Approval` |
| `safetyissue` | `Safety Issue` |
| `safetyobservation` | `Safety Observation` |
| `goodpractice` | `Good Practice` |

### Status-mapping (eksempel - tilpasses per prosjekt)

| Dalux status | Catenda topic_status |
|--------------|---------------------|
| `Open` | `Open` |
| `In Progress` | `In Progress` |
| `Resolved` | `Closed` |
| `Closed` | `Closed` |

### Dalux Attachment → Catenda Document Reference

| Dalux (TaskAttachmentRelation) | Catenda |
|--------------------------------|---------|
| `mediaFile.fileDownload` | Last ned → upload til Catenda Library |
| `mediaFile.mediaFileId` | Lagres som ekstern referanse |
| Opplastet dokument-ID | `document_reference.document_guid` |

---

## Synkroniseringslogikk

### Polling-strategi

```python
# Konfigurerbar polling-intervall
SYNC_INTERVAL_MINUTES = 15  # Kan justeres per prosjekt

# Inkrementell synk med timestamp
last_sync_timestamp = get_last_sync_timestamp(project_id)
changes = dalux_client.get_task_changes(project_id, since=last_sync_timestamp)
```

### Synk-flyt per task

```
1. Hent task fra Dalux
2. Sjekk om task allerede er synket (via ekstern referanse)
   ├── Nei: Opprett ny BCF Topic i Catenda
   └── Ja: Sammenlign og oppdater hvis endret
3. Hent attachments for task
4. For hver attachment:
   ├── Sjekk om allerede synket
   ├── Last ned fra Dalux
   ├── Last opp til Catenda Library
   └── Opprett document_reference på topic
5. Logg synk-resultat
6. Oppdater last_sync_timestamp
```

### Konflikt-håndtering

| Scenario | Håndtering |
|----------|------------|
| Task oppdatert i begge systemer | Dalux vinner (enveis-synk) |
| Task slettet i Dalux | Marker som "Synk deaktivert" i Catenda, ikke slett |
| Attachment slettet i Dalux | Behold i Catenda (dokumentasjon) |
| API-feil | Retry med eksponentiell backoff, varsle ved vedvarende feil |

---

## Datamodell for synk-metadata

### SyncMapping (ny tabell/entitet)

```python
class DaluxCatendaSyncMapping:
    id: str                      # Intern ID
    project_id: str              # Prosjekt-ID (vår)
    dalux_project_id: str        # Dalux prosjekt-ID
    catenda_project_id: str      # Catenda prosjekt-ID
    catenda_board_id: str        # Catenda BCF board-ID
    dalux_api_key: str           # Kryptert API-nøkkel
    dalux_base_url: str          # Dalux API base URL
    sync_enabled: bool           # Synk aktivert
    sync_interval_minutes: int   # Polling-intervall
    last_sync_at: datetime       # Siste synk-tidspunkt
    last_sync_status: str        # success/failed/partial
    created_at: datetime
    updated_at: datetime
```

### TaskSyncRecord (per synket task)

```python
class TaskSyncRecord:
    id: str
    sync_mapping_id: str         # Referanse til SyncMapping
    dalux_task_id: str           # Dalux task-ID
    catenda_topic_guid: str      # Catenda topic GUID
    dalux_updated_at: datetime   # Siste endring i Dalux
    catenda_updated_at: datetime # Siste oppdatering i Catenda
    sync_status: str             # synced/pending/failed
    last_error: str              # Feilmelding ved feil
    created_at: datetime
    updated_at: datetime
```

---

## Implementeringsplan

### Fase 1: Grunnleggende infrastruktur

- [ ] Opprett `DaluxClient` etter mønster fra `CatendaClient`
- [ ] Implementer autentisering med API-nøkkel
- [ ] Implementer endepunkter for projects, tasks, files
- [ ] Opprett database-modeller for synk-metadata

### Fase 2: Synk-logikk

- [ ] Implementer task → topic mapping
- [ ] Implementer attachment → document synk
- [ ] Opprett polling-scheduler (Azure Functions Timer Trigger eller lignende)
- [ ] Implementer inkrementell synk med `/tasks/changes`

### Fase 3: Administrasjon

- [ ] UI for å konfigurere Dalux-integrasjon per prosjekt
- [ ] Lagring av API-nøkkel (kryptert)
- [ ] Manuell trigger av synk
- [ ] Synk-logg og feilrapportering

### Fase 4: Produksjonssetting

- [ ] Feilhåndtering og retry-logikk
- [ ] Varsling ved synk-feil
- [ ] Monitoring og logging
- [ ] Dokumentasjon for entreprenører

---

## Sikkerhetshensyn

| Hensyn | Tiltak |
|--------|--------|
| API-nøkkel lagring | Kryptert i database, aldri i klartekst |
| Nøkkelrotasjon | Varsle før utløp, støtte enkel oppdatering |
| Tilgangskontroll | Kun prosjektadmin kan konfigurere integrasjon |
| Logging | Logg alle synk-operasjoner, men ikke sensitive data |
| Transport | HTTPS for all kommunikasjon |

---

## Fremtidige utvidelser

### Toveis-synk (hvis Dalux utvider API)

Dersom Dalux legger til skrivetilgang på tasks:
- Catenda topic-endringer → Dalux task-oppdatering
- Krever konflikt-håndtering med "sist endret vinner" eller manuell løsning

### Flere datatyper

- Checklists fra Dalux
- Inspection plans
- Quality registrations

### Webhook-støtte (hvis Dalux legger til)

Erstatte polling med push-basert synk for lavere latens og redusert API-belastning.

---

## Referanser

- [Dalux Build API v4.13 (SwaggerHub)](https://app.swaggerhub.com/apis-docs/Dalux/DaluxBuild-api/4.13)
- [API-identiteter i Dalux Build](https://support.dalux.com/hc/en-us/articles/20892369915292-API-identities-in-Dalux-Build-API)
- [Catenda BCF 3.0 API](https://api.catenda.com/developers/reference/bcf/3.0)
- Eksisterende Catenda-integrasjon: `backend/integrations/catenda/`
