# CloudEvents Adopsjon

**Plan for adopsjon av CloudEvents-spesifikasjonen i unified-timeline**

*Opprettet: 2025-12-20*

---

## Innhold

1. [Sammendrag](#1-sammendrag)
2. [Hva er CloudEvents?](#2-hva-er-cloudevents)
3. [Hvorfor CloudEvents?](#3-hvorfor-cloudevents)
4. [Azure Event Grid](#4-azure-event-grid)
5. [Relaterte spesifikasjoner](#5-relaterte-spesifikasjoner)
6. [Nåværende event-struktur](#6-nåværende-event-struktur)
7. [Mapping til CloudEvents](#7-mapping-til-cloudevents)
8. [Implementeringsplan](#8-implementeringsplan)
9. [Teknisk implementering](#9-teknisk-implementering)
10. [Migreringsstrategi](#10-migreringsstrategi)
11. [Referanser](#11-referanser)

---

## 1. Sammendrag

### Anbefaling

CloudEvents er en CNCF-standard for å beskrive events i et felles format. Denne planen beskriver hvordan unified-timeline kan adoptere CloudEvents inkrementelt for å oppnå:

- **Standardisering** - Felles format som er selvdokumenterende
- **Interoperabilitet** - Standardisert format som andre systemer kan konsumere
- **Fremtidssikring** - Industristandardformat med bred verktøystøtte
- **Azure Event Grid-klar** - Native kompatibilitet når/hvis Event Grid blir aktuelt

### Viktige avklaringer

| Spørsmål | Svar |
|----------|------|
| **Trenger vi Azure Event Grid?** | ⚠️ Vurder - gir retry, ingen datatap, fan-out |
| **Gir CloudEvents verdi uten Event Grid?** | ✅ Ja - standardisering og fremtidssikring |
| **Kan AsyncAPI/C4 gjøres parallelt?** | ⚠️ Delvis - C4 parallelt, AsyncAPI etter CloudEvents fase 1 |

### Estimert innsats per fase

| Fase | Beskrivelse | Innsats | Status |
|------|-------------|---------|--------|
| 1 | Kompatibilitetslag | 2-4 timer | ✅ Fullført |
| 2 | Serialiseringsstøtte | 4-8 timer | ✅ Fullført |
| 3 | ~~Webhook-integrasjon~~ | ~~8-16 timer~~ | ⏸️ Ikke aktuelt |
| 4 | Full migrering | 16-24 timer | ✅ Fullført |
| 5 | Azure Event Grid | 16-24 timer | Avhenger av behov |

### Anbefalt rekkefølge for alle spesifikasjoner

```
┌─────────────────────────────────────────────────────────────────────┐
│  Uke 1              │  Uke 2              │  Uke 3                  │
├─────────────────────┼─────────────────────┼─────────────────────────┤
│  CloudEvents Fase 1 │  AsyncAPI           │  AsyncAPI ferdig        │
│  (2-4 timer)        │  (4-8 timer)        │                         │
│                     │                     │                         │
│  C4/Structurizr     │  C4 ferdig          │  CloudEvents Fase 2     │
│  (2-4 timer)        │                     │  (valgfritt)            │
└─────────────────────┴─────────────────────┴─────────────────────────┘
```

---

## 2. Hva er CloudEvents?

CloudEvents er en åpen spesifikasjon fra [Cloud Native Computing Foundation (CNCF)](https://cloudevents.io/) for å beskrive event-data i et felles format.

### Kjernekonsepter

```
┌─────────────────────────────────────────────────────────────────┐
│                        CloudEvent                                │
├─────────────────────────────────────────────────────────────────┤
│  REQUIRED ATTRIBUTES (påkrevd)                                   │
│  ┌─────────────┬─────────────────────────────────────────────┐  │
│  │ specversion │ "1.0"                                       │  │
│  │ id          │ Unik identifikator for eventen              │  │
│  │ source      │ URI som identifiserer kilden                │  │
│  │ type        │ Beskriver event-kategorien                  │  │
│  └─────────────┴─────────────────────────────────────────────┘  │
│                                                                  │
│  OPTIONAL ATTRIBUTES (valgfrie)                                  │
│  ┌─────────────┬─────────────────────────────────────────────┐  │
│  │ time        │ Tidsstempel (RFC 3339)                      │  │
│  │ subject     │ Spesifikt subjekt innen source              │  │
│  │ datacontenttype │ Media type for data (f.eks. application/json) │
│  │ dataschema  │ URI til schema for data                     │  │
│  └─────────────┴─────────────────────────────────────────────┘  │
│                                                                  │
│  EXTENSION ATTRIBUTES (egendefinerte)                            │
│  ┌─────────────┬─────────────────────────────────────────────┐  │
│  │ actor       │ Hvem som utførte handlingen                 │  │
│  │ actorrole   │ Rolle (TE/BH)                               │  │
│  │ referstoid  │ Referanse til annen event                   │  │
│  └─────────────┴─────────────────────────────────────────────┘  │
│                                                                  │
│  DATA (payload)                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ { "tittel": "...", "beskrivelse": "...", ... }              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Nøkkelfordeler

| Fordel | Beskrivelse |
|--------|-------------|
| **Standardisering** | Felles format på tvers av systemer og leverandører |
| **Interoperabilitet** | SDK-er for Python, JavaScript, Go, Java, .NET, etc. |
| **Verktøystøtte** | Validering, routing, visualisering |
| **Cloud-integrasjon** | Native støtte i Azure Event Grid, AWS EventBridge, Knative |

---

## 3. Hvorfor CloudEvents?

### Relevans for unified-timeline

| Aspekt | Nåværende | Med CloudEvents |
|--------|-----------|-----------------|
| **Azure Event Grid** | Krever manuell mapping | Native kompatibilitet |
| **Catenda-webhooks** | Egendefinert format | Standardisert format |
| **Tredjepartsintegrasjon** | Dokumentasjon påkrevd | Selvdokumenterende |
| **Validering** | Pydantic (internt) | + CloudEvents SDK (eksternt) |

### Use cases

1. **Produksjonsmiljø (Azure)**
   - Publisere events til Azure Event Grid
   - Trigge Azure Functions basert på event-type
   - Overvåking og logging med Azure Monitor

2. **Catenda-integrasjon**
   - Motta webhooks i CloudEvents-format
   - Sende events tilbake til Catenda

3. **Fremtidige integrasjoner**
   - Andre byggeprosjektsystemer
   - Rapporteringsverktøy
   - Audit-systemer

---

## 4. Azure Event Grid

### Er Event Grid nødvendig?

Basert på nåværende produksjonsarkitektur (Azure Functions + Dataverse + Catenda) er **Azure Event Grid ikke implementert ennå**. Spørsmålet er om det gir verdi.

### Nåværende arkitektur (synkron)

```
┌─────────────────────────────────────────────────────────────────────┐
│  NÅVÆRENDE ARKITEKTUR (synkron Catenda-synk)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Frontend ──► Backend ──► Dataverse ──► Catenda API                │
│                                               │                      │
│                                         Catenda nede?                │
│                                               │                      │
│                                               ▼                      │
│                                    ❌ Request feiler                 │
│                                    ❌ Bruker må prøve igjen          │
│                                    ❌ Risiko for datatap             │
│                                                                      │
│   ✓ Enkel arkitektur                                                │
│   ✗ Ingen retry ved feil                                            │
│   ✗ Bruker blokkeres av treg Catenda-respons                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Arkitektur med Event Grid (asynkron)

```
┌─────────────────────────────────────────────────────────────────────┐
│  MED EVENT GRID (asynkron + retry + fan-out)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Frontend ──► Backend ──► Dataverse ────────► ✅ Lagret (garantert)│
│                               │                                      │
│                               └──► Event Grid ──► Catenda           │
│                                        │              │              │
│                                        │        Catenda nede?        │
│                                        │              │              │
│                                        │              ▼              │
│                                        │   ✅ Retry automatisk       │
│                                        │   ✅ Dead-letter ved feil   │
│                                        │   ✅ Ingen datatap          │
│                                        │                             │
│                                        ├──► Power BI (fan-out)       │
│                                        └──► Varsling (fan-out)       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Fordeler med Event Grid

| Fordel | Beskrivelse | Verdi |
|--------|-------------|-------|
| **Retry** | Automatisk retry ved feil (eksponentiell backoff) | ⭐⭐⭐ Essensielt |
| **Ingen datatap** | Event lagres i Dataverse FØR Catenda-kall | ⭐⭐⭐ Essensielt |
| **Fan-out** | Samme event til Catenda + Power BI + varsling | ⭐⭐⭐ Høy |
| **Asynkront** | Bruker venter ikke på Catenda-respons | ⭐⭐ Middels |
| **Dead-letter** | Events som feiler permanent fanges opp | ⭐⭐ Middels |

### Brukervennlighet ved asynkron arkitektur

For at asynkron synkronisering skal fungere godt, trengs:

| Krav | Implementering |
|------|----------------|
| **Umiddelbar bekreftelse** | "Event lagret ✓" - bruker vet at data er trygt |
| **Status-indikator** | "Synkroniseres med Catenda..." → "Synkronisert ✓" |
| **Varsling ved feil** | "Catenda-synk feilet - vi prøver igjen automatisk" |
| **Synk-status i UI** | Vis siste synk-tidspunkt per sak |

### Use cases

| Use case | Beskrivelse | Verdi | Kompleksitet |
|----------|-------------|-------|--------------|
| **Catenda-synk med retry** | Garantert levering til Catenda | ⭐⭐⭐ Høy | Middels |
| **Power BI real-time** | Push events til sanntids-dashboards | ⭐⭐ Middels | Lav |
| **Varsling** | E-post/SMS ved viktige events (frist godkjent) | ⭐⭐ Middels | Lav |
| **Audit-logging** | Route events til Azure Log Analytics | ⭐ Lav | Lav |
| **Multi-system** | ERP, prosjektstyring abonnerer | ⭐⭐⭐ Høy | Høy |

### Konklusjon

| Spørsmål | Svar |
|----------|------|
| **Trenger prosjektet Event Grid nå?** | ⚠️ Vurder for robusthet |
| **Hovedargument FOR** | Retry + ingen datatap ved Catenda-feil |
| **Hovedargument MOT** | Ekstra kompleksitet, krever asynkron UX |
| **Er CloudEvents nyttig uten Event Grid?** | ✅ Ja - standardisering, fremtidssikring |

**Anbefaling:** Event Grid gir betydelig verdi for robusthet (retry, ingen datatap) og fremtidig skalerbarhet (fan-out). Vurder å inkludere i produksjonsarkitekturen, men CloudEvents kan implementeres uavhengig som forberedelse.

---

## 5. Relaterte spesifikasjoner

CloudEvents er én av flere spesifikasjoner som kan styrke prosjektets arkitektur. Her er en oversikt over relaterte spesifikasjoner og hvordan de forholder seg til CloudEvents.

### Oversikt

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SPESIFIKASJONER                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   CloudEvents ◄─────────── AsyncAPI                                 │
│   (Event-format)           (API-dokumentasjon)                      │
│        │                        │                                    │
│        │                        │ refererer til CloudEvents-typer    │
│        │                        │                                    │
│        └────────────────────────┘                                    │
│                                                                      │
│   C4/Structurizr (uavhengig)                                        │
│   (Arkitekturdiagrammer)                                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### AsyncAPI

**Hva:** OpenAPI for event-drevne systemer - dokumenterer meldingsbaserte APIer.

**Status (2025-12-20):** ⏸️ Ikke prioritert nå - OpenAPI dekker nåværende behov.

**Vurdering:**

| Scenario | Verdi av AsyncAPI |
|----------|-------------------|
| Catenda webhooks inn | ⚠️ Begrenset - Catenda bruker proprietært format |
| Interne events | ❌ Lav - Events konsumeres kun internt via REST |
| Azure Event Grid (fase 5) | ✅ Høy - Dokumenterer utgående events |
| Tredjeparts-integrasjon | ✅ Høy - Når andre systemer abonnerer |

**Konklusjon:**
- OpenAPI (`backend/scripts/generate_openapi.py`) dokumenterer REST-APIet inkludert CloudEvents-skjemaer
- AsyncAPI gir begrenset merverdi før Azure Event Grid (fase 5)
- Bør vurderes når utgående event-strømmer implementeres

**Relevans for prosjektet (fremtidig):**
- Dokumentere utgående events til Azure Event Grid
- Spesifisere event-strømmer med schema-validering
- Generere dokumentasjon og klientkode automatisk

**Avhengighet til CloudEvents:**
- AsyncAPI bør implementeres **med** Azure Event Grid (fase 5)
- Kan referere til CloudEvents JSON Schema for event-typer
- Gir mest verdi for utgående event-strømmer

**Eksempel (AsyncAPI med CloudEvents):**
```yaml
asyncapi: 3.0.0
info:
  title: KOE Event API
  version: 1.0.0

channels:
  koe/events:
    messages:
      grunnlagOpprettet:
        contentType: application/cloudevents+json
        payload:
          $ref: '#/components/schemas/CloudEvent'

components:
  schemas:
    CloudEvent:
      type: object
      properties:
        specversion:
          type: string
          const: "1.0"
        type:
          type: string
          pattern: "^no\\.oslo\\.koe\\."
        # ... etc
```

### C4 Model / Structurizr

**Hva:** Hierarkisk arkitekturmodell med 4 nivåer (Context → Container → Component → Code).

**Status (2025-12-20):** ✅ Context + Container implementert

**Implementert:**
- Context-diagram: Viser TE, BH, KOE-system og Catenda
- Container-diagram: Frontend, Backend API, Event Store

**Fil:** [`docs/architecture/workspace.dsl`](./architecture/workspace.dsl)

**Bruk:**
```bash
# Online viewer (paste innhold)
https://structurizr.com/dsl

# CLI eksport til PlantUML
structurizr-cli export -workspace docs/architecture/workspace.dsl -format plantuml

# VS Code: Installer "Structurizr" extension for preview
```

**Ikke implementert (vurdert som unødvendig):**
- Component-diagram: Dekkes av `backend/STRUCTURE.md`
- Code-diagram: Koden er lesbar, overkill

**Avhengighet til CloudEvents:**
- **Ingen** - helt uavhengig

### Sammenligning

| Aspekt | CloudEvents | AsyncAPI | C4/Structurizr |
|--------|-------------|----------|----------------|
| **Formål** | Event-dataformat | API-dokumentasjon | Arkitekturdiagrammer |
| **Påvirker kode?** | Ja (modeller) | Nei (kun docs) | Nei (kun docs) |
| **Avhengighet** | Ingen | Bør ha CloudEvents først | Ingen |
| **Innsats** | 2-4 timer (fase 1) | 4-8 timer | 2-4 timer |
| **Vedlikehold** | Automatisk (Pydantic) | Manuelt/generert | Manuelt |

### Anbefalt rekkefølge

```
Uke 1                    Uke 2                    Uke 3
────────────────────────────────────────────────────────────
CloudEvents Fase 1  ───► AsyncAPI             ───► AsyncAPI
(2-4 timer)              (4-8 timer)               ferdig

C4/Structurizr      ───► C4 ferdig
(2-4 timer)

                         CloudEvents Fase 2
                         (valgfritt)
```

| Rekkefølge | Spesifikasjon | Begrunnelse |
|------------|---------------|-------------|
| **1. Først** | CloudEvents (fase 1) | Definerer event-formatet som AsyncAPI skal dokumentere |
| **2. Parallelt** | C4/Structurizr | Uavhengig av CloudEvents, kan gjøres når som helst |
| **3. Etter CE** | AsyncAPI | Bør referere til CloudEvents-typer for konsistens |

### Synergier

| Kombinasjon | Synergi |
|-------------|---------|
| AsyncAPI + CloudEvents | AsyncAPI kan referere til CloudEvents JSON Schema |
| C4 + AsyncAPI | C4 Container-diagram kan vise "events via AsyncAPI" |
| Alle tre | Komplett dokumentasjon: format + API + arkitektur |

---

## 6. Nåværende event-struktur

### SakEvent base-klasse

Fra `backend/models/events.py`:

```python
class SakEvent(BaseModel):
    event_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unik event-identifikator"
    )
    sak_id: str = Field(
        ...,
        description="Hvilken sak denne eventen tilhører"
    )
    event_type: EventType = Field(
        ...,
        description="Type hendelse"
    )
    tidsstempel: datetime = Field(
        default_factory=datetime.now,
        description="Når hendelsen skjedde"
    )
    aktor: str = Field(
        ...,
        description="Hvem som utførte handlingen"
    )
    aktor_rolle: Literal["TE", "BH"] = Field(
        ...,
        description="Rolle til aktøren"
    )
    kommentar: Optional[str] = Field(
        default=None,
        description="Valgfri kommentar/begrunnelse"
    )
    refererer_til_event_id: Optional[str] = Field(
        default=None,
        description="Event-ID som denne eventen svarer på"
    )
```

### Event-typer (EventType enum)

Systemet har 35+ event-typer fordelt på kategorier:

| Kategori | Event-typer |
|----------|-------------|
| Grunnlag | `grunnlag_opprettet`, `grunnlag_oppdatert`, `grunnlag_trukket` |
| Vederlag | `vederlag_krav_sendt`, `vederlag_krav_oppdatert`, `vederlag_krav_trukket` |
| Frist | `frist_krav_sendt`, `frist_krav_oppdatert`, `frist_krav_trukket` |
| Respons | `respons_grunnlag`, `respons_vederlag`, `respons_frist`, + oppdatert-varianter |
| Forsering | `forsering_varsel`, `forsering_respons`, `forsering_stoppet`, `forsering_kostnader_oppdatert` |
| Endringsordre | `eo_opprettet`, `eo_koe_lagt_til`, `eo_utstedt`, `eo_akseptert`, etc. |
| Sak | `sak_opprettet`, `sak_lukket` |

---

## 7. Mapping til CloudEvents

### Attributt-mapping

| CloudEvents | Nåværende felt | Type | Mapping-strategi |
|-------------|----------------|------|------------------|
| `specversion` | *(mangler)* | Required | Legge til `"1.0"` |
| `id` | `event_id` | Required | Rename |
| `source` | *(mangler)* | Required | Generere URI |
| `type` | `event_type` | Required | Prefiks med namespace |
| `time` | `tidsstempel` | Optional | Rename + ISO 8601 |
| `subject` | `sak_id` | Optional | Rename |
| `datacontenttype` | *(mangler)* | Optional | Legge til `"application/json"` |
| `dataschema` | *(mangler)* | Optional | URI til Pydantic JSON Schema |

### Extension-mapping

| CloudEvents Extension | Nåværende felt | Beskrivelse |
|-----------------------|----------------|-------------|
| `actor` | `aktor` | Hvem som utførte handlingen |
| `actorrole` | `aktor_rolle` | Rolle (TE/BH) |
| `referstoid` | `refererer_til_event_id` | Referanse til annen event |

### Source URI-struktur

Foreslått format:
```
/projects/{prosjekt_id}/cases/{sak_id}
```

Eksempler:
- `/projects/P-2025-001/cases/KOE-2025-042`
- `/projects/catenda-guid-123/cases/forsering-001`

### Type-navnekonvensjon

Foreslått format (reverse-DNS):
```
no.oslo.koe.{event_type}
```

Eksempler:
- `no.oslo.koe.grunnlag_opprettet`
- `no.oslo.koe.respons_vederlag`
- `no.oslo.koe.eo_utstedt`

---

## 8. Implementeringsplan

### Fase 1: Kompatibilitetslag (Prioritet: Høy) ✅ FULLFØRT

**Mål:** Legge til CloudEvents-attributter uten breaking changes.

**Oppgaver:**
- [x] Utvide `SakEvent` med CloudEvents-felter
- [x] Implementere `source` URI-generering
- [x] Implementere `type` namespace-prefiks
- [x] Legge til `specversion` og `datacontenttype`
- [x] Oppdatere enhetstester

**Kode-endringer:**
- `backend/models/events.py` - SakEvent arver fra CloudEventMixin
- `backend/models/cloudevents.py` - CloudEventMixin, validering, konstanter
- `backend/tests/test_models/test_cloudevents.py` - Omfattende tester

**Fullført:** 2025-12-20

---

### Fase 2: Serialiseringsstøtte (Prioritet: Middels) ✅ FULLFØRT

**Mål:** Støtte for eksport/import i CloudEvents-format.

**Oppgaver:**
- [x] Implementere `to_cloudevent()` metode
- [x] Implementere `from_cloudevent()` klassemetode
- [x] Legge til JSON Schema-eksport for `dataschema`
- [x] Oppdatere API-endepunkter med valgfri CloudEvents-output
- [x] Dokumentere API-endringer

**Kode-endringer:**
- `backend/lib/cloudevents/` - Schemas og HTTP binding
- `backend/routes/cloudevents_routes.py` - Schema API-endepunkter
- `backend/routes/event_routes.py` - Accept-header støtte
- `backend/docs/API.md` - CloudEvents dokumentasjon
- `backend/scripts/generate_openapi.py` - OpenAPI CloudEvents skjemaer

**Nye API-endepunkter:**
- `GET /api/cloudevents/schemas` - Liste alle skjemaer
- `GET /api/cloudevents/schemas/{event_type}` - Hent spesifikt skjema
- `GET /api/cloudevents/envelope-schema` - Hent envelope-skjema
- `GET /api/cloudevents/all-schemas` - Hent alle skjemaer

**Accept-header støtte:**
- `Accept: application/cloudevents+json` på `/api/cases/{sak_id}/timeline`

**Fullført:** 2025-12-20

---

### Fase 3: Webhook-integrasjon (⏸️ IKKE AKTUELT)

> **Status:** Denne fasen er ikke relevant for Catenda-integrasjonen.

**Begrunnelse:**

Catenda webhooks bruker et proprietært format, ikke CloudEvents:

```json
{
  "event": {
    "id": "evt_12345",
    "type": "issue.created"
  },
  "issue": { ... }
}
```

I tillegg:
- Catenda støtter **ikke** HMAC-signering av webhooks
- Catenda fjerner query parameters fra webhook URL-er
- Systemet sender ikke webhooks tilbake til Catenda (bruker REST API)

**Når blir denne fasen aktuell?**

Fase 3 blir relevant hvis/når:
1. **Azure Event Grid implementeres (Fase 5)** - da kan CloudEvents HTTP binding brukes for publisering
2. **Egen webhook-tjeneste for tredjeparter** - hvis andre systemer skal motta events fra oss
3. **Nye integrasjonspartnere** - som faktisk støtter CloudEvents

**Originale oppgaver (for fremtidig referanse):**
- ~~Oppdatere Catenda webhook-mottak til å støtte CloudEvents~~
- Implementere CloudEvents-format for utgående webhooks (aktuelt ved Fase 5)
- Legge til HTTP binding (CloudEvents over HTTP) (aktuelt ved Fase 5)
- ~~Implementere batch-støtte for flere events~~
- ~~Legge til signaturverifisering for CloudEvents~~

**Se:** Fase 5 (Azure Event Grid) for relatert arbeid

---

### Fase 4: Full migrering (Prioritet: Lav) ✅ FULLFØRT

**Mål:** CloudEvents som primærformat, legacy som fallback.

**Oppgaver:**
- [x] ~~Migrere eksisterende events til CloudEvents-format~~ (Slettet - kun testdata)
- [x] Oppdatere API til å alltid returnere CloudEvents-format
- [x] Oppdatere frontend til å konsumere CloudEvents
- [x] Fjerne legacy-felter (breaking change - ingen deprecation)
- [x] Oppdatere all dokumentasjon

**Kode-endringer:**
- `backend/routes/event_routes.py` - Alltid CloudEvents output
- `backend/lib/cloudevents/http_binding.py` - Summary og spor extension attributes
- `src/types/timeline.ts` - CloudEvent interface med extension attributes
- `src/types/api.ts` - TimelineResponse bruker CloudEvents
- `src/api/state.ts` - Konverterer mock-data til CloudEvents
- `src/api/forsering.ts` - TimelineEvent typer
- `src/api/endringsordre.ts` - TimelineEvent typer
- `src/components/views/Timeline.tsx` - CloudEvents field mapping
- `src/components/views/EventDetailModal.tsx` - CloudEvents field mapping
- `src/pages/CasePage.tsx` - CloudEvents typer
- `src/pages/ForseringPage.tsx` - CloudEvents typer
- `src/pages/EndringsordePage.tsx` - CloudEvents typer

**Testdata slettet:**
- Alle 901 testfiler i `backend/koe_data/events/` slettet (kun utvikling/testing)

**Fullført:** 2025-12-20

---

### Fase 5: Azure Event Grid-integrasjon (Prioritet: Avhenger av prod-planer)

**Mål:** Publisere events til Azure Event Grid.

> **Merk:** Denne fasen aktiverer deler av Fase 3 (CloudEvents HTTP binding for utgående events).

**Oppgaver:**
- [ ] Konfigurere Azure Event Grid topic
- [ ] Implementere event-publisering (CloudEvents-format via `to_cloudevent()`)
- [ ] Legge til CloudEvents HTTP binding for publisering
- [ ] Sette opp event-subscriptions for Azure Functions
- [ ] Implementere dead-letter håndtering
- [ ] Legge til overvåking og alerting

**Kode-endringer:**
- `backend/services/eventgrid_service.py` - Ny service
- `backend/lib/cloudevents/http_binding.py` - HTTP binding (fra Fase 3)
- `backend/config.py` - Azure-konfigurasjon
- Azure-infrastruktur (Terraform/Bicep)

**Estimat:** 16-24 timer (ekskl. infrastruktur)

**Risiko:** Middels - avhenger av Azure-oppsett

---

## 9. Teknisk implementering

### Fase 1: Kompatibilitetslag (detaljert)

#### Ny fil: `backend/models/cloudevents.py`

```python
"""
CloudEvents-støtte for unified-timeline.

Implementerer CloudEvents v1.0 spesifikasjonen:
https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md
"""
from pydantic import BaseModel, Field, computed_field
from typing import Optional, Literal, Any
from datetime import datetime


# CloudEvents namespace for dette prosjektet
CLOUDEVENTS_NAMESPACE = "no.oslo.koe"
CLOUDEVENTS_SPECVERSION = "1.0"


class CloudEventMixin(BaseModel):
    """
    Mixin som legger til CloudEvents-attributter.

    Brukes sammen med SakEvent for å gi CloudEvents-kompatibilitet
    uten å endre eksisterende feltstruktur.
    """

    @computed_field
    @property
    def specversion(self) -> str:
        """CloudEvents specification version."""
        return CLOUDEVENTS_SPECVERSION

    @computed_field
    @property
    def ce_id(self) -> str:
        """CloudEvents id (maps to event_id)."""
        return self.event_id

    @computed_field
    @property
    def ce_source(self) -> str:
        """
        CloudEvents source URI.

        Format: /projects/{prosjekt_id}/cases/{sak_id}
        """
        prosjekt_id = getattr(self, 'prosjekt_id', 'unknown')
        return f"/projects/{prosjekt_id}/cases/{self.sak_id}"

    @computed_field
    @property
    def ce_type(self) -> str:
        """
        CloudEvents type med namespace.

        Format: no.oslo.koe.{event_type}
        """
        return f"{CLOUDEVENTS_NAMESPACE}.{self.event_type.value}"

    @computed_field
    @property
    def ce_time(self) -> str:
        """CloudEvents time i ISO 8601 format."""
        if isinstance(self.tidsstempel, datetime):
            return self.tidsstempel.isoformat() + "Z"
        return str(self.tidsstempel)

    @computed_field
    @property
    def ce_subject(self) -> str:
        """CloudEvents subject (maps to sak_id)."""
        return self.sak_id

    @computed_field
    @property
    def ce_datacontenttype(self) -> str:
        """CloudEvents data content type."""
        return "application/json"

    def to_cloudevent(self) -> dict:
        """
        Eksporter event som CloudEvents-format.

        Returns:
            dict: Event i CloudEvents v1.0 format
        """
        ce = {
            # Required attributes
            "specversion": self.specversion,
            "id": self.ce_id,
            "source": self.ce_source,
            "type": self.ce_type,

            # Optional attributes
            "time": self.ce_time,
            "subject": self.ce_subject,
            "datacontenttype": self.ce_datacontenttype,

            # Extension attributes
            "actor": self.aktor,
            "actorrole": self.aktor_rolle,
        }

        # Legg til referanse hvis den finnes
        if self.refererer_til_event_id:
            ce["referstoid"] = self.refererer_til_event_id

        # Legg til data payload
        if hasattr(self, 'data'):
            ce["data"] = self.data.model_dump() if hasattr(self.data, 'model_dump') else self.data

        return ce

    @classmethod
    def from_cloudevent(cls, ce: dict, **kwargs):
        """
        Parse CloudEvent til intern event-struktur.

        Args:
            ce: CloudEvents dict
            **kwargs: Ekstra felter som ikke er i CloudEvent

        Returns:
            Event-instans
        """
        # Map CloudEvents attributter til interne felter
        mapped = {
            "event_id": ce.get("id"),
            "sak_id": ce.get("subject"),
            "tidsstempel": ce.get("time"),
            "aktor": ce.get("actor"),
            "aktor_rolle": ce.get("actorrole"),
            "refererer_til_event_id": ce.get("referstoid"),
        }

        # Ekstraher event_type fra type (fjern namespace)
        ce_type = ce.get("type", "")
        if ce_type.startswith(f"{CLOUDEVENTS_NAMESPACE}."):
            mapped["event_type"] = ce_type[len(f"{CLOUDEVENTS_NAMESPACE}."):]
        else:
            mapped["event_type"] = ce_type

        # Legg til data
        if "data" in ce:
            mapped["data"] = ce["data"]

        # Merge med ekstra kwargs
        mapped.update(kwargs)

        # Filtrer ut None-verdier
        mapped = {k: v for k, v in mapped.items() if v is not None}

        return cls.model_validate(mapped)
```

#### Oppdatert `SakEvent` i `backend/models/events.py`

```python
from backend.models.cloudevents import CloudEventMixin

class SakEvent(CloudEventMixin, BaseModel):
    """
    Base-klasse for alle events i systemet.

    Støtter både intern struktur og CloudEvents-format via CloudEventMixin.

    Intern bruk:
        event.event_id, event.sak_id, event.tidsstempel, etc.

    CloudEvents-eksport:
        event.to_cloudevent()  # Returnerer CloudEvents dict
    """
    # ... eksisterende felter uendret ...
```

#### Eksempel: Konvertering

```python
# Opprett event som vanlig
event = GrunnlagEvent(
    sak_id="KOE-2025-001",
    event_type=EventType.GRUNNLAG_OPPRETTET,
    aktor="Ola Nordmann",
    aktor_rolle="TE",
    data=GrunnlagData(
        tittel="Forsinket tegningsunderlag",
        hovedkategori="SVIKT",
        underkategori="MEDVIRK",
        beskrivelse="Tegninger ble levert 3 uker forsinket",
        dato_oppdaget="2025-12-15"
    )
)

# Eksporter som CloudEvents
ce = event.to_cloudevent()
print(json.dumps(ce, indent=2))
```

Output:
```json
{
  "specversion": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "source": "/projects/unknown/cases/KOE-2025-001",
  "type": "no.oslo.koe.grunnlag_opprettet",
  "time": "2025-12-20T10:30:00Z",
  "subject": "KOE-2025-001",
  "datacontenttype": "application/json",
  "actor": "Ola Nordmann",
  "actorrole": "TE",
  "data": {
    "tittel": "Forsinket tegningsunderlag",
    "hovedkategori": "SVIKT",
    "underkategori": "MEDVIRK",
    "beskrivelse": "Tegninger ble levert 3 uker forsinket",
    "dato_oppdaget": "2025-12-15"
  }
}
```

---

## 10. Migreringsstrategi

### Bakoverkompatibilitet

Migreringsstrategien sikrer at eksisterende kode fortsetter å fungere:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIGRERINGSPERIODE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Fase 1-3: Dual-format støtte                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Intern lagring: Eksisterende format (SakEvent)             ││
│  │  Ekstern eksport: CloudEvents (via to_cloudevent())         ││
│  │  Import: Støtter begge formater                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Fase 4: CloudEvents primær                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Intern lagring: CloudEvents format                         ││
│  │  Legacy-felter: Deprecated, fjernes i neste major versjon   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Migreringsscript

For fase 4 trengs et migreringsscript:

```python
# scripts/migrate_to_cloudevents.py

def migrate_event(event_dict: dict) -> dict:
    """Konverter legacy event til CloudEvents-format."""
    return {
        "specversion": "1.0",
        "id": event_dict["event_id"],
        "source": f"/projects/{event_dict.get('prosjekt_id', 'unknown')}/cases/{event_dict['sak_id']}",
        "type": f"no.oslo.koe.{event_dict['event_type']}",
        "time": event_dict["tidsstempel"],
        "subject": event_dict["sak_id"],
        "datacontenttype": "application/json",
        "actor": event_dict["aktor"],
        "actorrole": event_dict["aktor_rolle"],
        "referstoid": event_dict.get("refererer_til_event_id"),
        "data": event_dict.get("data", {})
    }
```

---

## 11. Referanser

### Spesifikasjoner
- [CloudEvents Specification v1.0](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md)
- [CloudEvents JSON Format](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/formats/json-format.md)
- [CloudEvents HTTP Protocol Binding](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/bindings/http-protocol-binding.md)

### SDK-er
- [Python SDK](https://github.com/cloudevents/sdk-python)
- [JavaScript SDK](https://github.com/cloudevents/sdk-javascript)

### Azure-integrasjon
- [Azure Event Grid CloudEvents support](https://learn.microsoft.com/en-us/azure/event-grid/cloud-event-schema)
- [Event Grid Namespaces](https://learn.microsoft.com/en-us/azure/event-grid/namespaces-cloud-events)

### Relaterte spesifikasjoner
- [AsyncAPI](https://www.asyncapi.com/) - API-dokumentasjon for event-drevne systemer
- [C4 Model](https://c4model.com/) - Arkitekturdiagrammer
- [Structurizr DSL](https://docs.structurizr.com/dsl) - DSL for C4-diagrammer

### Prosjektdokumentasjon
- [Arkitektur og Datamodell](./ARCHITECTURE_AND_DATAMODEL.md)
- [Backend Struktur](../backend/STRUCTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)
