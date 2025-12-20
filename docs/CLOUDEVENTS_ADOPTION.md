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
| **Trenger vi Azure Event Grid nå?** | ❌ Nei - nåværende arkitektur dekker behovet |
| **Gir CloudEvents verdi uten Event Grid?** | ✅ Ja - standardisering og fremtidssikring |
| **Kan AsyncAPI/C4 gjøres parallelt?** | ⚠️ Delvis - C4 parallelt, AsyncAPI etter CloudEvents fase 1 |

### Estimert innsats per fase

| Fase | Beskrivelse | Innsats | Prioritet |
|------|-------------|---------|-----------|
| 1 | Kompatibilitetslag | 2-4 timer | Høy |
| 2 | Serialiseringsstøtte | 4-8 timer | Middels |
| 3 | Webhook-integrasjon | 8-16 timer | Middels |
| 4 | Full migrering | 16-24 timer | Lav |
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

Basert på nåværende produksjonsarkitektur (Azure Functions + Dataverse + Catenda) er **Azure Event Grid ikke planlagt**. Den nåværende arkitekturen dekker behovet.

```
┌─────────────────────────────────────────────────────────────────────┐
│  NÅVÆRENDE ARKITEKTUR (uten Event Grid)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Frontend ──► Azure Functions ──► Dataverse                        │
│                      │                                               │
│                      └──► Catenda (direkte API-kall)                │
│                                                                      │
│   ✓ Fungerer for nåværende behov                                    │
│   ✓ Enklere arkitektur                                              │
│   ✓ Færre komponenter å vedlikeholde                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Når blir Event Grid relevant?

Event Grid blir relevant når **andre systemer skal konsumere events**:

| Use case | Beskrivelse | Verdi | Kompleksitet |
|----------|-------------|-------|--------------|
| **Catenda-synk** | Publiser events → trigger Function → oppdater Catenda | ⭐⭐⭐ Høy | Middels |
| **Power BI real-time** | Push events til Power BI for sanntids-dashboards | ⭐⭐ Middels | Lav |
| **Varsling** | E-post/SMS når viktige events skjer (frist godkjent, etc.) | ⭐⭐ Middels | Lav |
| **Audit-logging** | Route alle events til Azure Log Analytics | ⭐ Lav | Lav |
| **Multi-system** | ERP, prosjektstyring, andre systemer abonnerer | ⭐⭐⭐ Høy | Høy |

### Arkitektur med Event Grid (fremtidig)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Azure Functions (API)                           │
│  POST /api/events                                                    │
│    │                                                                 │
│    ├── 1. Valider event                                              │
│    ├── 2. Persist til Dataverse                                      │
│    └── 3. Publiser til Event Grid  ◄── FREMTIDIG                     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   Azure Event Grid    │◄── CloudEvents format
                │   (Topic)             │
                └───────────┬───────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │ Azure Function│ │ Power BI      │ │ Webhook       │
    │ → Catenda     │ │ Streaming     │ │ → Ekstern     │
    └───────────────┘ └───────────────┘ └───────────────┘
```

### Konklusjon

| Spørsmål | Svar |
|----------|------|
| **Trenger prosjektet Event Grid nå?** | ❌ Nei |
| **Når blir det relevant?** | Når andre systemer skal konsumere events |
| **Er CloudEvents nyttig uten Event Grid?** | ✅ Ja - standardisering, dokumentasjon, fremtidssikring |

**CloudEvents gir verdi uavhengig av Event Grid** - det handler om å ha et standardisert format som er klart for fremtidige integrasjoner.

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

**Relevans for prosjektet:**
- Dokumentere Catenda webhooks formelt
- Spesifisere event-strømmer med schema-validering
- Generere dokumentasjon og klientkode automatisk

**Avhengighet til CloudEvents:**
- AsyncAPI bør implementeres **etter** CloudEvents fase 1
- Kan referere til CloudEvents JSON Schema for event-typer
- Gir mer verdi når event-formatet er standardisert

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

**Relevans for prosjektet:**
- Visualisere kompleks arkitektur (frontend, backend, integrasjoner)
- Generere diagrammer fra kode (Structurizr DSL)
- Versjonskontrollert dokumentasjon

**Avhengighet til CloudEvents:**
- **Ingen** - kan implementeres helt uavhengig
- Kan gjøres parallelt med CloudEvents

**Eksempel (Structurizr DSL):**
```
workspace {
    model {
        te = person "Totalentreprenør" "Sender krav og dokumentasjon"
        bh = person "Byggherre" "Vurderer og godkjenner krav"

        koeSystem = softwareSystem "KOE System" "Håndterer endringsordrer" {
            frontend = container "React Frontend" "Brukergrensesnitt" "React 19, TypeScript"
            backend = container "Azure Functions" "API og forretningslogikk" "Python, Flask"
            eventStore = container "Dataverse" "Event Store" "Microsoft Dataverse"
        }

        catenda = softwareSystem "Catenda" "Prosjekthotell" "Ekstern"

        te -> frontend "Registrerer krav"
        bh -> frontend "Vurderer krav"
        frontend -> backend "REST API"
        backend -> eventStore "Lagrer events"
        backend -> catenda "Synkroniserer"
    }

    views {
        systemContext koeSystem "SystemContext" {
            include *
            autoLayout
        }
        container koeSystem "Containers" {
            include *
            autoLayout
        }
    }
}
```

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

### Fase 1: Kompatibilitetslag (Prioritet: Høy)

**Mål:** Legge til CloudEvents-attributter uten breaking changes.

**Oppgaver:**
- [ ] Utvide `SakEvent` med CloudEvents-felter
- [ ] Implementere `source` URI-generering
- [ ] Implementere `type` namespace-prefiks
- [ ] Legge til `specversion` og `datacontenttype`
- [ ] Oppdatere enhetstester

**Kode-endringer:**
- `backend/models/events.py` - Utvide SakEvent
- `backend/models/cloudevents.py` - Ny modul for CloudEvents-støtte
- `tests/models/test_cloudevents.py` - Nye tester

**Estimat:** 2-4 timer

**Risiko:** Lav - additive endringer, ingen breaking changes

---

### Fase 2: Serialiseringsstøtte (Prioritet: Middels)

**Mål:** Støtte for eksport/import i CloudEvents-format.

**Oppgaver:**
- [ ] Implementere `to_cloudevent()` metode
- [ ] Implementere `from_cloudevent()` klassemetode
- [ ] Legge til JSON Schema-eksport for `dataschema`
- [ ] Oppdatere API-endepunkter med valgfri CloudEvents-output
- [ ] Dokumentere API-endringer

**Kode-endringer:**
- `backend/models/events.py` - Serialiseringsmetoder
- `backend/routes/event_routes.py` - Accept-header støtte
- `backend/lib/cloudevents/` - Ny modul for serialisering

**Estimat:** 4-8 timer

**Risiko:** Lav - valgfri funksjonalitet

---

### Fase 3: Webhook-integrasjon (Prioritet: Middels)

**Mål:** Sende og motta webhooks i CloudEvents-format.

**Oppgaver:**
- [ ] Oppdatere Catenda webhook-mottak til å støtte CloudEvents
- [ ] Implementere CloudEvents-format for utgående webhooks
- [ ] Legge til HTTP binding (CloudEvents over HTTP)
- [ ] Implementere batch-støtte for flere events
- [ ] Legge til signaturverifisering for CloudEvents

**Kode-endringer:**
- `backend/routes/webhook_routes.py` - CloudEvents-mottak
- `backend/services/webhook_service.py` - CloudEvents-sending
- `backend/integrations/catenda/client.py` - CloudEvents-støtte

**Estimat:** 8-16 timer

**Risiko:** Middels - krever koordinering med Catenda

---

### Fase 4: Full migrering (Prioritet: Lav)

**Mål:** CloudEvents som primærformat, legacy som fallback.

**Oppgaver:**
- [ ] Migrere eksisterende events til CloudEvents-format
- [ ] Oppdatere Event Store til å lagre CloudEvents
- [ ] Oppdatere frontend til å konsumere CloudEvents
- [ ] Fjerne legacy-felter (med deprecation-periode)
- [ ] Oppdatere all dokumentasjon

**Kode-endringer:**
- `backend/repositories/event_repository.py` - CloudEvents-lagring
- `src/types/timeline.ts` - CloudEvents TypeScript-typer
- `src/api/events.ts` - CloudEvents-parsing
- Migreringsscript for eksisterende data

**Estimat:** 16-24 timer

**Risiko:** Høy - breaking changes, krever grundig testing

---

### Fase 5: Azure Event Grid-integrasjon (Prioritet: Avhenger av prod-planer)

**Mål:** Publisere events til Azure Event Grid.

**Oppgaver:**
- [ ] Konfigurere Azure Event Grid topic
- [ ] Implementere event-publisering
- [ ] Sette opp event-subscriptions for Azure Functions
- [ ] Implementere dead-letter håndtering
- [ ] Legge til overvåking og alerting

**Kode-endringer:**
- `backend/services/eventgrid_service.py` - Ny service
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
        hovedkategori="FORSINKELSE_BH",
        underkategori="PROJ",
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
    "hovedkategori": "FORSINKELSE_BH",
    "underkategori": "PROJ",
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
