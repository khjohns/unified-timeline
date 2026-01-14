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
| `subject` | `title` | **NB:** Dalux bruker `subject`, ikke `title` |
| `description` | `description` | Direkte mapping |
| `type.name` | `topic_type` | **NB:** `type` er et objekt med `name`-felt |
| `status` | `topic_status` | Mapping-tabell (se under) |
| `assignedTo.email` | `assigned_to` | E-post som identifikator |
| `createdBy.email` | `creation_author` | E-post som identifikator |
| `created` | `creation_date` | ISO 8601 datoformat |
| `deadline` | `due_date` | ISO 8601 datoformat |
| `userDefinedFields.items` | `description` | Formateres som markdown-liste |

### Type-mapping (implementert)

Catenda har begrenset sett med gyldige topic_type. Mapping:

| Dalux type | Catenda topic_type |
|------------|-------------------|
| `RUH` | `Warning` |
| `task` | `Info` |
| `Oppgave produksjon` | `Info` |
| `safetyissue` | `Error` |
| `safetyobservation` | `Warning` |
| `goodpractice` | `Info` |
| `approval` | `Info` |
| *(ukjent)* | `Info` (default) |

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

**⚠️ Viktig (verifisert 2026-01-14):**
- Task attachments og File Areas er **separate lagringssystemer** i Dalux
- Task attachments: Liste OK, men nedlasting krever utvidede API-rettigheter (403)
- File Areas: Full tilgang til liste og nedlasting
- Document reference krever **formatert UUID** (med bindestreker), ikke kompakt

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
    # NB: API-nøkkel lagres i .env (DALUX_API_KEY), ikke i database
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

### Fase 1: Grunnleggende infrastruktur ✅

- [x] Opprett `DaluxClient` etter mønster fra `CatendaClient`
- [x] Implementer autentisering med API-nøkkel
- [x] Implementer endepunkter for projects, tasks, files, attachments
- [x] Opprett database-modeller for synk-metadata (Supabase)
- [x] Opprett interaktiv meny (`dalux_menu.py`) for testing

### Fase 2: Synk-logikk ✅

- [x] Implementer task → topic mapping
- [x] Implementer `DaluxSyncService` med full synk
- [x] Verifiser attachment → document synk (File Areas fungerer, task attachments krever utvidede rettigheter)
- [x] Verifiser mappe-opprettelse i Catenda (fungerer med riktig payload)
- [ ] Opprett polling-scheduler (Azure Functions Timer Trigger eller lignende)
- [ ] Implementer inkrementell synk med `/tasks/changes` (delvis - strukturforskjeller)

### Fase 3: Administrasjon

- [ ] UI for å konfigurere Dalux-integrasjon per prosjekt
- [x] Lagring av API-nøkkel i `.env` (sikker, enkel)
- [x] Manuell trigger av synk via CLI og meny
- [x] Synk-logg og feilrapportering (via logger)

### Fase 4: Produksjonssetting

- [x] Feilhåndtering og retry-logikk (per task)
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

## Arkitekturbeslutninger (Fase 1)

Implementert januar 2026. For detaljert analyse, se [ADR-001-dalux-sync.md](ADR-001-dalux-sync.md).

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| Synk-retning | Enveis (Dalux → Catenda) | Dalux API har kun lesetilgang |
| Synk-mekanisme | Polling (15 min) | Dalux støtter ikke webhooks |
| Trigger | Manuell CLI | Fase 1 MVP, scheduler i Fase 2 |
| Database | Supabase | Konsistent med eksisterende arkitektur |
| API-nøkler | Miljøvariabel (.env) | Sikker, følger 12-factor app |
| Event Sourcing | Nei | Infrastruktur-data, ikke forretningsdomene |
| Klient-mønster | Speiler CatendaClient | Konsistens og gjenkjennelighet |

### Kjente begrensninger

- [ ] Ingen automatisk scheduler (manuell trigger via CLI/meny)
- [x] ~~Attachment-synk ikke implementert~~ → File Areas fungerer, task attachments krever utvidede rettigheter
- [ ] Kun single-tenant (én API-nøkkel per instans)
- [ ] Inkrementell synk har strukturforskjeller som må håndteres
- [ ] Kommentarer ikke tilgjengelig (finnes ikke i Dalux API)

### Testet og verifisert (januar 2026)

- ✅ Full synk av RUH-tasks fra Dalux → Catenda BCF topics
- ✅ Metadata formateres som lesbar markdown i description
- ✅ Type-mapping til gyldige Catenda topic types
- ✅ Synk-status lagres i Supabase for sporing
- ✅ File Areas → Catenda bibliotek (nedlasting og opplasting fungerer)
- ✅ Mappe-opprettelse i Catenda via API
- ✅ Document reference med formatert UUID
- ✅ Task changes API gir endringshistorikk (action, timestamp, felt)

### API-begrensninger (verifisert januar 2026)

| Funksjon | Status | Kommentar |
|----------|--------|-----------|
| Task grunndata | ✅ | Alle felt tilgjengelig |
| Egendefinerte felt | ✅ | Alle verdier inkl. referanser |
| Task changes (historikk) | ✅ | action, timestamp, modifiedBy, felt |
| File Areas (filer) | ✅ | Liste og nedlasting fungerer |
| Task attachments | ⚠️ | Liste OK, nedlasting krever utvidede API-rettigheter |
| Lokasjonsbilder | ⚠️ | Liste OK, nedlasting krever utvidede API-rettigheter |
| Kommentarer | ❌ | Finnes ikke i Dalux API |

**NB:** API-rettigheter styres av prosjekteier (entreprenør) i Dalux Admin.

---

## Gap-analyse: Dalux API vs PDF-eksport

> Verifisert 2026-01-14 mot RUH145 ("Tilkomst/rømning")

### Sammendrag

**API-dekning:** ~60% av PDF-innhold tilgjengelig via API

| Kategori | Status | Kommentar |
|----------|--------|-----------|
| Grunndata | ✅ | Nummer, tittel, type, workflow |
| Lokasjon | ✅ | Bygning, etasje, koordinater, tegning, soner |
| Egendefinerte felt | ✅ | Alle verdier inkl. referanser |
| Vedlegg | ⚠️ | Liste OK, nedlasting 403 |
| Historikk | ❌ | API-bug, se under |
| Beskrivelser | ❌ | Ikke i task endpoint |
| Ansvarlig | ❌ | Ikke i API-respons |

### Kritisk: Changes API-begrensning

**Verifisert oppførsel:**

```
Total changes i systemet: 592
Returnert fra API:        100 (alltid de eldste)
Nyeste tilgjengelig:      2025-10-01
since-parameter:          Ignoreres
Paginering:               Ikke støttet
```

**Konsekvens:**
- Endringer etter oktober 2025 utilgjengelige
- Nyere saker (RUH58+) har 0 changes i API
- Audit log/historikk kan ikke hentes for nyere saker

### Detaljert feltsammenligning (RUH145)

| Felt | PDF | API | Status |
|------|-----|-----|--------|
| Nummer | RUH145 | `number` | ✅ |
| Tittel | Tilkomst/rømning | `subject` | ✅ |
| Type | RUH | `type.name` | ✅ |
| Bygning | Tilbygg | `location.building.name` | ✅ |
| Etasje | Plan 1 | `location.level.name` | ✅ |
| Tegning | Riggplan (Versjon 4) | `location.drawing.name` | ✅ |
| Koordinater | 86.05, 92.00, 199.50 | `location.coordinate.xyz` | ✅ |
| Soner | Mellombygg Sør | `location.zones[].zone.name` | ✅ |
| Arbeidsforløp | 3. RUH fra BH | `workflow.name` | ✅ |
| Opprettelsesdato | 3. des. 2025 | `created` | ✅ |
| Opprettet av | Erik Henriksen | `createdBy.userId` (kun ID) | ⚠️ |
| **Entreprise** | 00 Byggherre | – | ❌ |
| **Tidsfrist** | 4. des 2025 | – | ❌ |
| **Ansvarlig** | (Godkjent, lukket) | – | ❌ |
| **Beskrivelse** | "Denne lå oppe på rampe..." | – | ❌ |

### Egendefinerte felt (alle tilgjengelige)

| Felt | Verdi | API-path |
|------|-------|----------|
| Tiltak | Legges under gangbru/rampe | `userDefinedFields.items[].values[].text` |
| Klassifisering | Farlig forhold | ✅ |
| Status tiltak | Tiltak er tilfredsstillende | ✅ |
| Risikoområde | Grønn | ✅ (som "Green") |
| Fokusområde | 3 + 27 | ✅ (multi-value) |
| OBF kategori | Fare for fall | ✅ |

### Historikk fra PDF (ikke i API)

| Tidspunkt | Hendelse | API |
|-----------|----------|-----|
| 3. des 09:00 | Opprettet, Tildelt | ❌ |
| 3. des 13:07 | Utbedret | ❌ |
| 7. jan 13:54 | Godkjent | ❌ |

### Implementeringsstatus i kodebasen

**Fil:** `backend/services/dalux_sync_service.py`

| Dalux-felt | Vår mapping | Status |
|------------|-------------|--------|
| `subject` | `title` | ✅ Implementert |
| `type.name` | `topic_type` | ✅ Implementert |
| `userDefinedFields` | `description` (appended) | ✅ Implementert |
| `status` | `topic_status` | ⚠️ Default "Open" |
| `description` | – | ❌ Ikke tilgjengelig |
| `assignedTo` | – | ❌ Ikke i API |
| `deadline` | `due_date` | ❌ TODO i kode |
| `location` | – | ❌ Ikke mappet |
| `changes` | – | ❌ API-begrensning |

**TODOs i koden (linje 404, 426):**
```python
# TODO: Add due_date, assigned_to when BCF API supports it
# TODO: Implement attachment sync in phase 2
```

### Anbefalte tiltak

1. **Kontakt Dalux support** - Spør om historikk/audit API eller rettelse av changes-bug
2. **Bruk PDF-eksport** - Som supplement for full historikk der det trengs
3. **Lokal event-logg** - Lagre endringer vi gjør selv i Unified Timeline
4. **Utvid mapping** - Legg til `location`, `workflow` i BCF description

---

## Referanser

- [Dalux Build API v4.13 (SwaggerHub)](https://app.swaggerhub.com/apis-docs/Dalux/DaluxBuild-api/4.13)
- [API-identiteter i Dalux Build](https://support.dalux.com/hc/en-us/articles/20892369915292-API-identities-in-Dalux-Build-API)
- [Catenda BCF 3.0 API](https://api.catenda.com/developers/reference/bcf/3.0)
- Eksisterende Catenda-integrasjon: `backend/integrations/catenda/`
