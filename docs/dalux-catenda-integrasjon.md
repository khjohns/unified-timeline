# Dalux-Catenda Integrasjon

> **Sist oppdatert:** 2026-01-14 (RUH7 gap-analyse, API-kartlegging)
> **Status:** Fase 2 implementert med berikede beskrivelser, avventer avklaringer fra OBF

---

## 1. Sammendrag

Enveis-integrasjon fra Dalux Build til Catenda for synkronisering av tasks og dokumenter fra entreprenørens Dalux-prosjekt til byggherrens Catenda-prosjekt.

### Dekningsgrad

| Område | Implementert | Gap | Prioritet |
|--------|--------------|-----|-----------|
| Forutsetninger | 90% | RUH-avklaring | Lav |
| Dokumenter | 50% | Mappekonfig, task attachments krever utvidede API-rettigheter | **Høy** |
| Saker/oppgaver | 60% | Scheduler, ID-avklaring | **Høy** |
| Brukere/GDPR | 50% | GDPR-vurdering | Medium |
| Modeller | 20% | Kun metadata, ikke BIM-kobling | Lav |
| Synkfrekvens | 40% | Scheduler | **Høy** |
| Feilhåndtering | 60% | Varsling | Medium |

### API-dekning (Dalux → Catenda)

| Saksalder | Nåværende | Potensial | Kommentar |
|-----------|-----------|-----------|-----------|
| Eldre saker (RUH1-55) | ~85% | **~95%** | Med firma- og entrepriseoppslag |
| Nyere saker (RUH58+) | ~60% | ~65% | Historikk mangler pga API-begrensning |

**Nye endepunkter identifisert:**
- `/3.1/projects/{id}/companies` - Firmanavn fra companyId
- `/1.0/projects/{id}/workpackages` - Entreprisenavn fra workpackageId
- `/5.1/projects` - Prosjektnavn

---

## 2. Bakgrunn og formål

| Aspekt | Beskrivelse |
|--------|-------------|
| **Hvem** | Byggherre tilbyr integrasjonstjeneste, entreprenør er Dalux-kunde |
| **Hvorfor** | Sømløs opplevelse for entreprenør - unngå dobbeltregistrering |
| **Ansvar** | Entreprenør er kontraktuelt ansvarlig for at data finnes i Catenda |
| **Fallback** | Ved synk-feil må entreprenør manuelt legge inn i Catenda |

### Forutsetninger

| Krav | Status | Kommentar |
|------|--------|-----------|
| Én-veis synk | ✅ Støttet | Dalux API har kun lesetilgang |
| Catenda som master | ✅ Støttet | Arkitekturen er designet for dette |
| RUH-unntak | ⚠️ Må avklares | Nåværende impl. synkroniserer RUH som `Warning` |

---

## 3. Kravvurdering

### 3.1 Dokumenter

**OBF-behov:**
- TE ansvarlig for opplasting i Catenda
- Automatisk overføring av filer fra TE sin UE
- Filtyper: Office, punktsky, dwg, dxf, Revit, IFC, smc
- Mappestruktur: Konfigurerbar mapping (mappe X → mappe Y)

**Vurdering:**

| Krav | Status | Kommentar |
|------|--------|-----------|
| Vedleggssynk | ✅ Verifisert | File Areas API fungerer, task attachments gir 403 |
| Filtyper | ✅ Uproblematisk | Catenda støtter alle nevnte formater |
| Mappekonfigurasjon | 🔴 Ikke implementert | Må utvikles |
| Automatisk mappeopprettelse | ✅ Verifisert | Mapper kan opprettes via API |

**Tekniske begrensninger - Dalux (to separate lagringssystemer):**

| Lagring | Beskrivelse | Liste | Nedlasting |
|---------|-------------|-------|------------|
| **Task attachments** | Bilder/filer direkte på saker | ✅ OK | ❌ 403 |
| **Lokasjonsbilder** | Plantegninger med markering | ✅ OK | ❌ 403 |
| **File Areas** | Prosjektdokumenter (PDF, tegninger) | ✅ OK | ✅ OK |

**NB:** Årsak til 403 er begrensning i API-nøkkelens rettigheter, styres av prosjekteier (entreprenør) i Dalux Admin.

**Tekniske begrensninger - Catenda:**
- **Bibliotek:** Kan IKKE opprettes via API, må opprettes manuelt i Catenda UI først
- **Mapper:** ✅ Kan opprettes via API med `POST /v2/projects/{id}/libraries/{libId}/items`

### 3.2 Saker og oppgaver

**OBF-behov:**
- Utveksling hvert 5. minutt
- ID-nummer identisk i begge systemer
- Oppgavelister → forhåndsdefinerte sakslister
- Felt som ikke finnes skal opprettes automatisk

**Vurdering:**

| Krav | Status | Kommentar |
|------|--------|-----------|
| Synk hvert 5 min | ⚠️ Avvik | Implementert med 15 min, ingen scheduler |
| Identiske ID | ❌ **Ikke mulig** | Dalux: numerisk, Catenda: UUID |
| Oppgaveliste-mapping | 🔴 Ikke implementert | Krever konfigurasjon |
| Auto-opprett felt | ❌ **Ikke praktisk** | Krever manuell sakstype-oppsett |

**ID-problemet:**
- Dalux bruker numerisk ID: `6070718657`
- Catenda genererer UUID: `a1b2c3d4-e5f6-7890-...`
- Disse kan IKKE være identiske
- **Løsning:** Begge ID-er lagres i synk-mapping og kan vises i brukergrensesnittet

**Egendefinerte felt:**
- Catenda krever at sakstyper/sakslister opprettes manuelt
- Felt må defineres på forhånd i Catenda UI
- **Løsning:** Ukjente felt fra Dalux legges i description-feltet som strukturert markdown

### 3.3 Brukere og persondata

**OBF-behov:**
- Automatisk kobling basert på e-postadresse
- GDPR må vurderes

**Vurdering:**

| Krav | Status | Kommentar |
|------|--------|-----------|
| E-post-kobling | ✅ Implementert | `assignedTo.email` → `assigned_to` |
| GDPR-vurdering | 🔴 Ikke adressert | Krever juridisk vurdering |

**GDPR-anbefalinger:**
- Behandlingsgrunnlag for persondata-overføring
- Databehandleravtale mellom partene
- Rutiner for sletting ved prosjektslutt

### 3.4 Modeller og BIM

**OBF-behov:**
- Catenda som master for modeller
- Modellokasjonsinfo (koordinater) fra Dalux kobles til modell
- Saker koblet til modell skal få identisk kobling

**Vurdering:**

| Krav | Status | Kommentar |
|------|--------|-----------|
| Catenda som modell-master | ✅ OK | Ingen konflikt |
| Koordinat-kobling | ⚠️ Delvis mulig | Dalux eksponerer XYZ, transformasjon usikker |
| Sak → modell-kobling | 🔴 Vanskelig | Dalux gir kun objektnavn, ikke IFC GUID |

**Dalux API eksponerer:**
```
location:
  coordinate.xyz: { x, y, z }
  bimObject: { categoryName, name }
  building, level, room (referanser)
```

**Mangler for fullstendig kobling:**
- Ingen IFC GUID (kun objektnavn)
- Koordinatsystem er modellspesifikt
- Ingen viewpoint-data

**Anbefalt løsning:** Synkroniser lokasjonsmeta som strukturert tekst i BCF topic description:

```markdown
## Lokasjon (fra Dalux)
- Bygning: Stovner skole - Bygg A
- Etasje: 2. etasje
- Rom: 2.034 Klasserom
- Koordinater: X=12.5, Y=34.2, Z=8.0
- BIM-objekt: Wall - Innervegg type 1
```

### 3.5 Synkroniseringsfrekvens

**OBF-behov:**
- Kontinuerlig synkronisering
- Helst hvert 5. minutt
- Minimum én gang daglig

**Vurdering:**

| Krav | Status | Kommentar |
|------|--------|-----------|
| Scheduler | 🔴 Ikke implementert | Kun manuell trigger |
| 5 min intervall | ⚠️ Aggressivt | Mulig API rate limits |
| Daglig minimum | ✅ Enkelt | Kan settes opp med cron/scheduler |

**Anbefaling:**

| Datatype | Anbefalt intervall | Begrunnelse |
|----------|-------------------|-------------|
| Saker/oppgaver | 15 min | Balanse mellom aktualitet og API-belastning |
| Dokumenter | 30-60 min | Større filer, mindre tidskritisk |

### 3.6 Vedlikehold og feilhåndtering

**OBF-behov:**
- Fleksibel ved API-endringer
- Varsling ved synkroniseringsfeil
- Detaljert feilinfo (hva, hvorfor, hva som ikke ble synket)
- Info om retry-forsøk

**Vurdering:**

| Krav | Status | Kommentar |
|------|--------|-----------|
| Fleksibel arkitektur | ✅ OK | Modulær klient-design |
| Varsling | 🔴 Ikke implementert | Må utvikles |
| Feillogging | ✅ Implementert | Logger med detaljer |
| Retry-logikk | ✅ Implementert | Per task med backoff |

**Varsling kan implementeres via:**
- E-post ved kritiske feil
- Dashboard for synk-status
- Slack/Teams-integrasjon (valgfritt)

---

## 4. Teknisk arkitektur

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

### Retningsbegrensninger

| Retning | Status | Kommentar |
|---------|--------|-----------|
| Dalux → Catenda | ✅ Mulig | Dalux API har full lesetilgang |
| Catenda → Dalux | ❌ Ikke mulig | Dalux API har ingen skrivetilgang på tasks |

### Arkitekturbeslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| Synk-retning | Enveis (Dalux → Catenda) | Dalux API har kun lesetilgang |
| Synk-mekanisme | Polling (15 min) | Dalux støtter ikke webhooks |
| Trigger | Manuell CLI | Fase 1 MVP, scheduler i Fase 2 |
| Database | Supabase | Konsistent med eksisterende arkitektur |
| API-nøkler | Miljøvariabel (.env) | Sikker, følger 12-factor app |
| Klient-mønster | Speiler CatendaClient | Konsistens og gjenkjennelighet |

---

## 5. Dalux API

### Autentisering

```http
Header: X-API-KEY: {api_nøkkel}
```

**API-nøkkel oppsett:**
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

**Viktig:** Gamle Dalux API-nøkler utløper **28. februar 2026** - alle må over på API-identiteter.

### Base URL

Base URL er **kundespesifikk** og må fås fra Dalux support:

```
https://{node}.field.dalux.com/service/api/{versjon}/{endepunkt}
```

| Komponent | Beskrivelse | Eksempel |
|-----------|-------------|----------|
| `{node}` | Kundespesifikk server | `node1` |
| `{versjon}` | API-versjon | `5.1` |
| `{endepunkt}` | Ressursen | `projects` |

**Stovner skole:** `https://node1.field.dalux.com/service/api/`

### Endepunkter

**Tasks og saker:**

| Endepunkt | Beskrivelse | Bruk |
|-----------|-------------|------|
| `GET /5.2/projects/{id}/tasks` | Alle tasks | Initial synk |
| `GET /2.3/projects/{id}/tasks/changes` | Endringer siden sist | Inkrementell synk, historikk |
| `GET /3.4/projects/{id}/tasks/{taskId}` | Enkelt task | Ved behov |
| `GET /1.1/projects/{id}/tasks/attachments` | Vedlegg på tasks | Vedleggsliste |

**Brukere og firmaer:**

| Endepunkt | Beskrivelse | Bruk |
|-----------|-------------|------|
| `GET /1.2/projects/{id}/users` | Prosjektbrukere | Oppslag userId → navn, companyId |
| `GET /3.1/projects/{id}/companies` | Firmaer på prosjekt | Oppslag companyId → firmanavn |
| `GET /1.0/projects/{id}/workpackages` | Entrepriser/arbeidspakker | Oppslag workpackageId → entreprisenavn |

**Filer og dokumenter:**

| Endepunkt | Beskrivelse |
|-----------|-------------|
| `GET /5.1/projects/{id}/file_areas` | Liste filområder |
| `GET /6.0/projects/{id}/file_areas/{areaId}/files` | Liste filer |
| `GET /2.0/.../files/{id}/revisions/{rev}/content` | Last ned fil |

### API-begrensninger (verifisert januar 2026)

| Funksjon | Status | Kommentar |
|----------|--------|-----------|
| Task grunndata | ✅ | Alle felt tilgjengelig |
| Egendefinerte felt | ✅ | Alle verdier inkl. referanser |
| Project users | ✅ | Brukeroppslag (userId → navn, companyId) fungerer |
| **Companies** | ✅ | Firmaoppslag (companyId → firmanavn) fungerer |
| **Workpackages** | ✅ | Entrepriseoppslag (workpackageId → navn) fungerer |
| Task changes (historikk) | ⚠️ | Kun 100 eldste, paginering ignoreres |
| File Areas | ✅ | Liste og nedlasting fungerer |
| Task attachments | ⚠️ | Liste OK, nedlasting krever utvidede rettigheter |
| Lokasjonsbilder | ⚠️ | Liste OK, nedlasting krever utvidede rettigheter |
| Kommentarer | ❌ | Finnes ikke i Dalux API |
| **Stedfortreder** | ❌ | Ikke i API (deputy/substitute) |
| **Prosjektnummer** | ❌ | Kun projectName, ikke nummer |

---

## 6. Datamodell og mapping

### Dalux Task → Catenda BCF Topic

| Dalux (ApiTaskGet) | Catenda (BCF Topic) | Kommentar |
|--------------------|---------------------|-----------|
| `taskId` | `guid` | Lagres som ekstern referanse |
| `subject` | `title` | NB: Dalux bruker `subject`, ikke `title` |
| `description` | `description` | Direkte mapping |
| `type.name` | `topic_type` | NB: `type` er objekt med `name`-felt |
| `status` | `topic_status` | Mapping-tabell |
| `assignedTo.email` | `assigned_to` | E-post som identifikator |
| `createdBy.email` | `creation_author` | E-post som identifikator |
| `created` | `creation_date` | ISO 8601 |
| `deadline` | `due_date` | ISO 8601 |
| `userDefinedFields.items` | `description` | Formateres som markdown |

### Type-mapping

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

### Status-mapping

| Dalux status | Catenda topic_status |
|--------------|---------------------|
| `Open` | `Open` |
| `In Progress` | `In Progress` |
| `Resolved` | `Closed` |
| `Closed` | `Closed` |

### Synk-metadata (database)

```python
class DaluxCatendaSyncMapping:
    id: str                      # Intern ID
    project_id: str              # Prosjekt-ID (vår)
    dalux_project_id: str        # Dalux prosjekt-ID
    catenda_project_id: str      # Catenda prosjekt-ID
    catenda_board_id: str        # Catenda BCF board-ID
    dalux_base_url: str          # Dalux API base URL
    sync_enabled: bool           # Synk aktivert
    sync_interval_minutes: int   # Polling-intervall
    last_sync_at: datetime       # Siste synk-tidspunkt
    last_sync_status: str        # success/failed/partial

class TaskSyncRecord:
    id: str
    sync_mapping_id: str         # Referanse til SyncMapping
    dalux_task_id: str           # Dalux task-ID
    catenda_topic_guid: str      # Catenda topic GUID
    sync_status: str             # synced/pending/failed
    last_error: str              # Feilmelding ved feil
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

## 7. Gap-analyse: API vs PDF-eksport

> Verifisert 2026-01-14 mot RUH1 (eldre) og RUH145 (nyere)

### Eldre saker (RUH1-55): ~85% dekning

For saker opprettet før oktober 2025:

| Kategori | Status | API-felt | Implementert |
|----------|--------|----------|--------------|
| Grunndata | ✅ | `number`, `subject`, `type.name` | ✅ I tittel/type |
| Arbeidsforløp | ✅ | `workflow.name` | ✅ I Saksinfo |
| Opprettet av | ✅ | `createdBy.userId` | ✅ Med brukeroppslag |
| Opprettet dato | ✅ | `created` | ✅ I Saksinfo |
| Frist | ✅ | `changes[].fields.deadline` | ✅ I Saksinfo |
| Lokasjon | ✅ | `location.building`, `level`, `coordinate`, `drawing` | ✅ I description |
| Egendefinerte felt | ✅ | `userDefinedFields.items[]` | ✅ I description |
| **Beskrivelser** | ✅ | `changes[].description` | ✅ I historikk |
| **Ansvarlig** | ✅ | `changes[].fields.currentResponsible` | ✅ Med brukeroppslag |
| **Tildeling** | ✅ | `changes[].fields.assignedTo.roleName` | ✅ I historikk |
| **Endringslogg** | ✅ | `changes[].action`, `timestamp` | ✅ I historikk |
| Vedlegg | ⚠️ | Liste OK, nedlasting 403 | ✅ Liste i description |

**Eksempel resultat i Catenda (RUH2 Sikre graveskråning):**
```markdown
**Saksinfo:**
- **Arbeidsforløp:** Innmelding RUH
- **Opprettet av:** Ivar Andresen
- **Opprettet:** 2025-06-25 05:34
- **Frist:** 2025-06-25

**Egendefinerte felt:**
- **Tiltak:** Sperre med festivalgjerder eller kjetting
- **Klassifisering:** Farlig forhold (Ingenting har skjedd)
- **Status tiltak:** Tiltak er tilfredsstillende
...

**Lokasjon:**
- Bygning: Tilbygg
- Etasje: Plan 1
- Koordinater: X=81.1, Y=91.7, Z=199.5

**Vedlegg (2 stk):**
- 📎 b3711304-19b5-4cc3-9d76-0a1a21121b76.jpg (2025-06-25)
...

**Historikk (3 hendelser):**
- 👤 [2025-06-25 05:34] **ASSIGN**: "Åpen graveskråning"
  - Tildelt: HMS-leder
  - Ansvarlig: Eirik Strøm-Storaker
- ✅ [2025-06-25 07:48] **COMPLETE**
  - Tildelt: Betonmast funksjonærer
  - Ansvarlig: Ivar Andresen
- ✓ [2025-06-25 07:50] **APPROVE**
```

### Nyere saker (RUH58+): ~60% dekning

For saker opprettet etter oktober 2025:

| Kategori | Status | Kommentar |
|----------|--------|-----------|
| Grunndata | ✅ | Fungerer |
| Lokasjon | ✅ | Fungerer |
| Egendefinerte felt | ✅ | Fungerer |
| Historikk | ❌ | Changes API returnerer 0 |
| Beskrivelser | ❌ | Kun via changes |
| Ansvarlig | ❌ | Kun via changes |

### Rotårsak: Changes API-begrensning

```
Total changes i systemet: 592
Returnert fra API:        100 (alltid de eldste)
Tidsspenn returnert:      2025-06-24 → 2025-10-01
since-parameter:          Ignoreres
Paginering:               Ikke støttet
```

### Feltsammenligning (RUH145 - nyere sak)

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
| Egendefinerte felt | 6 stk | `userDefinedFields` | ✅ |
| **Entreprise** | 00 Byggherre | – | ❌ |
| **Tidsfrist** | 4. des 2025 | – | ❌ |
| **Ansvarlig** | (Godkjent, lukket) | – | ❌ |
| **Beskrivelse** | "Denne lå oppe på rampe..." | – | ❌ |
| **Historikk** | 3 hendelser | – | ❌ |

### Feltsammenligning (RUH7 - eldre sak, juli 2025)

RUH7 er innenfor Changes API-grensen og gir **~80% dekning**.

#### Metadata

| Felt | PDF | API | Status |
|------|-----|-----|--------|
| Nummer | RUH7 | `number` | ✅ |
| Tittel | Manglende sikring av kant | `subject` | ✅ |
| Type | RUH | `type.name` | ✅ |
| Prosjekt | Stovner skole | – | ⚠️ Ikke i task, separat kall |
| Prosjekt nr. | 12200037 | – | ❌ |
| Bygning | Tilbygg | `location.building.name` | ✅ |
| Etasje | Plan U1 | `location.level.name` | ✅ |
| Tegning | Orienterende plantegning 1. Underetasje (Versjon 3) | `location.drawing.name` | ✅ |
| Koordinater | 108.81, 86.62, 194.10 | `location.coordinate.xyz` | ✅ |
| **Entreprise** | 303 Graving og sprenging | `workpackageId` (kun ID) | ⚠️ |
| Arbeidsforløp | 3.1 RUH til UE | `workflow.name` | ✅ |
| Opprettelsesdato | 2. jul. 2025, 12:45 | `created` | ✅ |
| Tidsfrist | 3. jul 2025 | `changes[0].fields.deadline` | ✅ |
| Opprettet av | Erik Henriksen, Advansia AS | `createdBy.userId` → user lookup | ✅ (kun navn) |
| **Ansvarlig** | (Godkjent, lukket) | – | ❌ |

#### Egendefinerte felt

| Felt | PDF | API | Status |
|------|-----|-----|--------|
| Tiltak | Her må det settes opp en sperring... | `userDefinedFields.items[]` | ✅ |
| Klassifisering | Farlig forhold (Ingenting har skjedd) | ✅ | ✅ |
| Status tiltak | Tiltak er tilfredsstillende | ✅ | ✅ |
| Risikoområde | Grønn | `"Green"` | ✅ |
| Fokusområde | 82 Grøfter og skråninger | ✅ | ✅ |

#### Historikk (4 hendelser)

| Hendelse | PDF | API | Status |
|----------|-----|-----|--------|
| 1. 2025-07-02 12:45 - Opprettet | ✅ | `changes[0]` | ✅ |
| Oppdatert av | Erik Henriksen, Advansia AS | `modifiedBy.userId` → navn | ✅ (uten firma) |
| Tildelt | Eirik Strøm-Storaker, Betonmast Oslo AS | `currentResponsible.userId` → navn | ✅ (uten firma) |
| Tildelt til (rolle) | Betonmast Oslo AS | `assignedTo.roleName` | ⚠️ Kun rollenavn |
| Beskrivelse | "Det er her langt ned til bunne..." | `changes[].description` | ✅ |
| 2. 2025-07-02 17:53 - Videresendt | ✅ | `changes[1]` | ✅ |
| **Stedfortreder for** | Eirik Strøm-Storaker | – | ❌ |
| Entreprise: før → etter | 00 Byggherre → 303 Graving | `workpackageId` endret | ⚠️ Kun ID |
| Arbeidsforløp: før → etter | 3. RUH fra BH → 3.1 RUH til UE | – | ❌ Kun nåværende |
| 3. 2025-07-04 13:29 - Oppdatert | ✅ | `changes[2]` | ✅ |
| Risikoområde: Gul → Grønn | ✅ | Kun ny verdi | ⚠️ |
| 4. 2025-07-09 15:02 - Godkjent | ✅ | `changes[3]` | ✅ |
| **Stedfortreder for** | Eirik Strøm-Storaker | – | ❌ |
| action: approve | ✅ | ✅ | ✅ |

#### Vedlegg (3 stk)

| Felt | PDF | API | Status |
|------|-----|-----|--------|
| Bilde 1.1 | 2025-07-02, 11.34 | `attachments[0]` | ✅ |
| Bilde 1.2 | 2025-07-02, 11.34 | `attachments[1]` | ✅ |
| Bilde 4.1 | – | `attachments[2]` | ✅ |
| **Annotasjon** | "Sikres iht. faktaark" | – | ❌ |
| **Sekvensnummer** | 1.1, 1.2, 4.1 | – | ❌ |
| **Kobling til hendelse** | – | – | ❌ |

### Kritiske mangler identifisert og løst

| Manglende data | PDF viser | API-løsning | Status |
|----------------|-----------|-------------|--------|
| **Prosjektnavn** | "Stovner skole" | `GET /5.1/projects` → `projectName` | ✅ Tilgjengelig |
| **Prosjektnummer** | "12200037" | Ikke i API | ❌ Mangler |
| **Firmanavn** | "Betonmast Oslo AS" | `GET /3.1/projects/{id}/companies` + `users[].companyId` | ✅ Tilgjengelig |
| **Entreprise-navn** | "303 Graving og sprenging" | `GET /1.0/projects/{id}/workpackages` → `name` | ✅ Tilgjengelig |
| **Stedfortreder** | "Stedfortreder for: X" | Ikke i API (bekreftet i OpenAPI spec) | ❌ Mangler |
| **Workflow-endringer** | "før → etter" | Kun nåværende verdi | ❌ Mangler |
| **Bilde-annotasjoner** | Tekst-overlay | Ikke i API | ❌ Mangler |

### API-kartlegging (verifisert 2026-01-14)

#### Nye endepunkter som kan brukes

| Endepunkt | Versjon | Data | Eksempel |
|-----------|---------|------|----------|
| `/projects` | 5.1 | Prosjektnavn | `"Stovner skole"` |
| `/projects/{id}/companies` | 3.1 | Firmanavn fra companyId | `80114481806` → `"Betonmast Oslo AS"` |
| `/projects/{id}/workpackages` | 1.0 | Entreprise-navn fra workpackageId | `68588227614` → `"303 Graving og sprenging"` |

#### Workpackages (26 stk på Stovner skole)

```
64634399787: 00 Byggherre
67735523287: 01 Totalentreprenør
68588227614: 303 Graving og sprenging
68486333915: 305 Betongarbeider
67888420660: 306 Prefabrikkerte elementer
65597732346: 307 Stålkonstruksjoner
65764491748: 312 Tømrerarbeid
66697872173: 317 Tekkearbeider
67746005842: 321 Malerarbeid
68582401129: 328 Riving
...
```

#### Companies (26 stk på Stovner skole)

```
80114481806: Betonmast Oslo AS
S326259798427303936: Advansia AS
S326260404982382592: Oslobygg KF
S306296086551592960: Sigurd Furulund Maskin AS
...
```

#### Felt som forblir utilgjengelige

| Felt | Beskrivelse | Konsekvens |
|------|-------------|------------|
| Prosjektnummer | Internt nummeringssystem | Kan ikke vises |
| Stedfortreder | "Stedfortreder for: X" ved delegering | Tap av kontekst |
| Workflow før/etter | Kun nåværende verdi, ikke endringshistorikk | Tap av endringsdetaljer |
| Bilde-annotasjoner | Tekst tegnet på bilder i Dalux | Tap av visuell informasjon |

---

## 8. Implementeringsstatus

### Fase 1: Grunnleggende infrastruktur ✅

- [x] Opprett `DaluxClient` etter mønster fra `CatendaClient`
- [x] Implementer autentisering med API-nøkkel
- [x] Implementer endepunkter for projects, tasks, files, attachments
- [x] Opprett database-modeller for synk-metadata (Supabase)
- [x] Opprett interaktiv meny (`dalux_menu.py`) for testing

### Fase 2: Synk-logikk ✅

- [x] Implementer task → topic mapping
- [x] Implementer `DaluxSyncService` med full synk
- [x] Verifiser attachment → document synk (File Areas fungerer)
- [x] Verifiser mappe-opprettelse i Catenda
- [ ] Opprett polling-scheduler (Azure Functions Timer Trigger)
- [ ] Implementer inkrementell synk med `/tasks/changes`

### Fase 3: Administrasjon

- [ ] UI for å konfigurere Dalux-integrasjon per prosjekt
- [x] Lagring av API-nøkkel i `.env`
- [x] Manuell trigger av synk via CLI og meny
- [x] Synk-logg og feilrapportering (via logger)

### Fase 4: Produksjonssetting

- [x] Feilhåndtering og retry-logikk (per task)
- [ ] Varsling ved synk-feil
- [ ] Monitoring og logging
- [ ] Dokumentasjon for entreprenører

### Mapping-implementering (kodebasen)

**Fil:** `backend/services/dalux_sync_service.py`

| Dalux-felt | Vår mapping | Status |
|------------|-------------|--------|
| `number` + `subject` | `title` | ✅ "RUH1 Tittel..." |
| `type.name` | `topic_type` | ✅ Implementert |
| `workflow.name` | `description` (Saksinfo) | ✅ Arbeidsforløp |
| `createdBy.userId` | `description` (Saksinfo) | ✅ Med brukeroppslag |
| `created` | `description` (Saksinfo) | ✅ Opprettet dato |
| `deadline` (fra changes) | `description` (Saksinfo) | ✅ Frist |
| `userDefinedFields` | `description` (markdown) | ✅ Egendefinerte felt |
| `location` | `description` (markdown) | ✅ Lokasjon |
| `attachments` | `description` (liste) | ✅ Vedlegg |
| `changes[].description` | `description` (historikk) | ✅ Beskrivelser |
| `changes[].fields.assignedTo.roleName` | `description` (historikk) | ✅ Tildeling |
| `changes[].fields.currentResponsible` | `description` (historikk) | ✅ Med brukeroppslag |
| `status` | `topic_status` | ⚠️ Default "Open" |

**Brukeroppslag:**
- Project Users API (`/1.2/projects/{id}/users`) brukes til å slå opp navn fra userId
- Kryptiske IDer som `82349_7E9jqjiOrx1SHAz9` erstattes med navn som "Eirik Strøm-Storaker"

### Testet og verifisert

- ✅ Full synk av RUH-tasks fra Dalux → Catenda BCF topics
- ✅ Saksnummer inkludert i tittel (f.eks. "RUH1 Sikre graveskråning")
- ✅ Metadata formateres som lesbar markdown i description
- ✅ Lokasjon (bygning, etasje, tegning, koordinater) i description
- ✅ Vedleggsliste i description (filnavn og dato)
- ✅ Historikk fra Changes API med full beskrivelse (ingen trunkering)
- ✅ Brukeroppslag: userId → navn via Project Users API
- ✅ Type-mapping til gyldige Catenda topic types
- ✅ Synk-status lagres i Supabase for sporing
- ✅ File Areas → Catenda bibliotek (nedlasting og opplasting)
- ✅ Mappe-opprettelse i Catenda via API
- ✅ Document reference med formatert UUID
- ✅ `--limit` opsjon for testing av synk

---

## 9. Avklaringer påkrevd fra OBF

| # | Tema | Spørsmål | Alternativ |
|---|------|----------|------------|
| 1 | RUH-saker | Hvordan håndtere RUH? | a) Ekskludere, b) Markere spesielt, c) Synkronisere som vanlig |
| 2 | ID-problemet | Aksepteres at Dalux-ID og Catenda-ID ikke er identiske? | Begge lagres og vises |
| 3 | Manglende brukere | Hva skjer hvis Dalux-bruker ikke finnes i Catenda? | a) Sak uten tildeling, b) Synk feiler, c) Bruker opprettes |
| 4 | Synkfrekvens | Er 15 min akseptabelt? | OBF ønsker 5 min, mulig rate limit-problemer |
| 5 | Egendefinerte felt | Aksepteres at ukjente felt legges i description? | Alternativ: Manuell oppsett per prosjekt |
| 6 | Modellkobling | Aksepteres metadata-løsning uten direkte viewpoint-kobling? | IFC GUID ikke tilgjengelig fra Dalux |
| 7 | API-rettigheter | Kan API-nøkkelen få utvidede rettigheter for task attachments? | Styres av entreprenør i Dalux Admin |

---

## 10. Forutsetninger for produksjon

### Manuelt i Catenda

- [ ] Bibliotek opprettet
- [ ] Sakstyper/sakslister definert med ønskede felt
- [ ] Topic board konfigurert

### Konfigurasjon

- [ ] Mappemapping (Dalux → Catenda)
- [ ] Oppgaveliste-mapping
- [ ] API-nøkler for begge systemer

### Juridisk

- [ ] GDPR-vurdering godkjent
- [ ] Databehandleravtale på plass

---

## 11. Sikkerhet

| Hensyn | Tiltak |
|--------|--------|
| API-nøkkel lagring | Miljøvariabel (.env), aldri i klartekst eller database |
| Nøkkelrotasjon | Varsle før utløp, støtte enkel oppdatering |
| Tilgangskontroll | Kun prosjektadmin kan konfigurere integrasjon |
| Logging | Logg alle synk-operasjoner, men ikke sensitive data |
| Transport | HTTPS for all kommunikasjon |

---

## 12. Fremtidige utvidelser

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

### Anbefalte tiltak

#### Implementert ✅

1. ~~**Implementer changes-mapping**~~ ✅
   - `changes[].description` → historikk i description
   - `changes[].fields.currentResponsible` → brukeroppslag til navn
   - `changes[].fields.assignedTo.roleName` → rolle i historikk
2. ~~**Utvid task-mapping**~~ ✅
   - `location` → i BCF description
   - `workflow.name` → i Saksinfo
3. ~~**Legg til manglende felt**~~ ✅
   - `workflow.name` → arbeidsforløp
   - `createdBy` → opprettet av (med brukeroppslag)
   - `created` → opprettet dato
   - `deadline` (fra changes) → frist

#### Kan implementeres (nye funn)

4. **Implementer firmaoppslag** - Bruk `/3.1/projects/{id}/companies`:
   - Hent companyId fra bruker via `/1.2/projects/{id}/users`
   - Slå opp firmanavn fra `/3.1/projects/{id}/companies`
   - Vis "Erik Henriksen, Advansia AS" i stedet for bare "Erik Henriksen"

5. **Implementer entreprise-navn** - Bruk `/1.0/projects/{id}/workpackages`:
   - Slå opp workpackageId fra changes-data
   - Vis "303 Graving og sprenging" i stedet for workpackageId

6. **Implementer prosjektnavn** - Bruk `/5.1/projects`:
   - Cache prosjektnavn ved oppstart av synk
   - Inkluder i metadata/saksinfo

#### Krever ekstern avklaring

7. **Kontakt Dalux support** - Spør om:
   - Paginering/offset for changes API (returnerer kun 100 eldste)
   - Prosjektnummer-felt (ikke tilgjengelig per nå)
   - Stedfortreder-informasjon (ikke i API)

8. **Lokal event-logg** - Lagre endringer vi gjør selv i Unified Timeline

---

## 13. Referanser

- [Dalux Build API v4.13 (SwaggerHub)](https://app.swaggerhub.com/apis-docs/Dalux/DaluxBuild-api/4.13)
- [API-identiteter i Dalux Build](https://support.dalux.com/hc/en-us/articles/20892369915292-API-identities-in-Dalux-Build-API)
- [Catenda BCF 3.0 API](https://api.catenda.com/developers/reference/bcf/3.0)
- [Catenda Document API](https://developers.catenda.com/document-api)
- Lokal OpenAPI-spec: `docs/Dalux-DaluxBuild-api-4.13-resolved.json`
- Eksisterende Catenda-integrasjon: `backend/integrations/catenda/`
