# KOE Backend API Documentation

## Overview

This API implements an Event Sourcing architecture for managing NS 8407 change order claims (Krav om Endringsordre).

## Authentication

All state-changing endpoints require two authentication mechanisms:

### 1. CSRF Token
For POST/PUT/DELETE requests, include the CSRF token in the header:
```
X-CSRF-Token: <token>
```

Get a token from:
```
GET /api/csrf-token
```

### 2. Magic Link Token
For case-specific operations, include the magic link token as a Bearer token:
```
Authorization: Bearer <magic-link-token>
```

Magic links are generated when a case is created and posted as comments in Catenda.

---

## Events API

### Submit Event
`POST /api/events`

Submit a single event to a case with optimistic concurrency control.

**Request:**
```json
{
  "sak_id": "SAK-20251218-001",
  "expected_version": 1,
  "event": {
    "event_type": "grunnlag_opprettet",
    "aktor": "Ola Nordmann",
    "aktor_rolle": "TE",
    "data": {
      "tittel": "Forsinket tegningsunderlag uke 45",
      "hovedkategori": "ENDRING",
      "underkategori": "IRREG",
      "beskrivelse": "Mottok pålegg om endring uten formell endringsordre",
      "dato_oppdaget": "2025-12-18",
      "kontraktsreferanse": "32.1"
    }
  },
  "catenda_topic_id": "optional-guid-for-pdf-upload",
  "pdf_base64": "optional-base64-pdf",
  "pdf_filename": "optional-filename.pdf"
}
```

**Response 201:**
```json
{
  "success": true,
  "event_id": "c3133059-2178-419b-8d72-346964acb417",
  "new_version": 2,
  "state": { /* computed SakState */ },
  "pdf_uploaded": true,
  "pdf_source": "client"
}
```

**Response 409 (Version Conflict):**
```json
{
  "success": false,
  "error": "VERSION_CONFLICT",
  "expected_version": 1,
  "current_version": 3,
  "message": "Tilstanden har endret seg. Vennligst last inn på nytt."
}
```

---

### Event Types

#### Grunnlag (Basis/Grounds)
- `grunnlag_opprettet` - Initial grounds submission
- `grunnlag_oppdatert` - Update grounds
- `grunnlag_trukket` - Withdraw grounds

**Required data fields:**
```json
{
  "tittel": "Short descriptive title",
  "hovedkategori": "ENDRING|SVIKT|ANDRE|FORCE_MAJEURE",
  "underkategori": "See valid combinations below",
  "beskrivelse": "Detailed description",
  "dato_oppdaget": "2025-12-18"
}
```

**Valid category combinations:**

| hovedkategori | underkategorier |
|---------------|-----------------|
| ENDRING | EO, IRREG, SVAR_VARSEL, LOV_GJENSTAND, LOV_PROSESS, GEBYR, SAMORD |
| SVIKT | MEDVIRK, PROSJEKT, ARBEIDSGRUNNLAG, KOORDINERING, MATERIALER, HINDRING |
| ANDRE | MENGDE, MASSEOVERSKR, REGULERING, ANNET |
| FORCE_MAJEURE | FM_EGEN, FM_BH |

---

#### Vederlag (Compensation)
- `vederlag_krav_sendt` - Submit compensation claim
- `vederlag_krav_oppdatert` - Update claim

**Required data fields:**
```json
{
  "metode": "ENHETSPRISER|REGNINGSARBEID|FASTPRIS_TILBUD",
  "belop_direkte": 150000.0,
  "begrunnelse": "Justification for the claim"
}
```

**Vederlagsmetoder:**

| metode | Description | NS 8407 ref |
|--------|-------------|-------------|
| ENHETSPRISER | Unit prices (contract or adjusted) | §34.3 |
| REGNINGSARBEID | Cost-plus with estimate | §30.2/§34.4 |
| FASTPRIS_TILBUD | Fixed price / Tender | §34.2.1 |

---

#### Frist (Deadline Extension)
- `frist_krav_sendt` - Submit deadline extension claim
- `frist_krav_oppdatert` - Update claim
- `frist_krav_spesifisert` - Specify days for neutral notice (§33.6.1/§33.6.2)

**Required data fields for `frist_krav_sendt`:**
```json
{
  "varsel_type": "noytralt|spesifisert|begge|force_majeure",
  "begrunnelse": "Justification",
  "antall_dager": 14,
  "spesifisert_varsel": {
    "dato_sendt": "2025-12-18"
  }
}
```

**Required data fields for `frist_krav_spesifisert`:**
```json
{
  "antall_dager": 14,
  "begrunnelse": "Justification for the specified days",
  "er_svar_pa_etterlysning": true,
  "ny_sluttdato": "2025-03-15",
  "berorte_aktiviteter": "Critical path activities affected"
}
```

**Notes on specification (§33.6):**
- `antall_dager` must be > 0 (actually specifying days)
- `er_svar_pa_etterlysning`: true if responding to BH's demand (§33.6.2)
- If TE fails to respond to etterlysning, the claim is lost

**Varsel types:**

| varsel_type | Description | Required fields |
|-------------|-------------|-----------------|
| noytralt | Neutral/preliminary warning (§33.4) | noytralt_varsel |
| spesifisert | Specified claim with days | spesifisert_varsel, antall_dager |
| begge | Both neutral and specified | Both + antall_dager |
| force_majeure | Force majeure extension (§33.3) | - |

---

### Submit Batch
`POST /api/events/batch`

Submit multiple events atomically. Used for initial case creation.

**Request:**
```json
{
  "sak_id": "SAK-20251218-001",
  "expected_version": 1,
  "events": [
    { "event_type": "grunnlag_opprettet", "data": { ... } },
    { "event_type": "vederlag_krav_sendt", "data": { ... } },
    { "event_type": "frist_krav_sendt", "data": { ... } }
  ]
}
```

---

### Get Case State
`GET /api/cases/{sak_id}/state`

Get computed state for a case (requires magic link auth).

**Response:**
```json
{
  "version": 3,
  "state": {
    "sak_id": "SAK-20251218-001",
    "sakstittel": "Forsinket tegningsunderlag uke 45",
    "overordnet_status": "UNDER_BEHANDLING",
    "grunnlag": { ... },
    "vederlag": { ... },
    "frist": { ... }
  }
}
```

---

### Get Case Timeline
`GET /api/cases/{sak_id}/timeline`

Get full event timeline for UI display.

---

### Get Case History
`GET /api/cases/{sak_id}/historikk`

Get revision history for vederlag and frist tracks.

---

## Utility API

### Get CSRF Token
`GET /api/csrf-token`

**Response:**
```json
{
  "csrfToken": "abc123...",
  "expiresIn": 3600
}
```

### Verify Magic Link
`GET /api/magic-link/verify?token={token}`

**Response:**
```json
{
  "success": true,
  "sakId": "SAK-20251218-001"
}
```

### Health Check
`GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "service": "koe-backend"
}
```

### Validate User
`POST /api/validate-user`

Validates if an email belongs to a user in the Catenda project.

**Request:**
```json
{
  "email": "user@example.com",
  "sakId": "SAK-20251218-001"
}
```

---

## Webhook API

### Catenda Webhook
`POST /webhook/catenda/{secret_path}`

Receives webhook events from Catenda when topics are created or modified.

**Supported events:**
- `issue.created` - New topic created
- `issue.modified` - Topic updated
- `issue.status.changed` - Status changed

**Note:** Topics created via API may not trigger webhooks. Use the utility endpoint to check if a case was created.

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable message"
}
```

**Common error codes:**
- `MISSING_PARAMETERS` - Required fields missing
- `VALIDATION_ERROR` - Data validation failed
- `VERSION_CONFLICT` - Optimistic concurrency conflict
- `BUSINESS_RULE_VIOLATION` - Business rule check failed
- `UNAUTHORIZED` - Authentication required

---

## Forsering API (§33.8)

Forsering (acceleration) cases are created when BH rejects a justified deadline extension claim. Per NS 8407 §33.8, TE can treat the rejection as an order to accelerate if the cost is within 30% of the liquidated damages that would have accrued.

### Get Candidate KOE Cases
`GET /api/forsering/kandidater`

Get KOE cases that can be used for a forsering claim (cases with rejected deadline extensions).

**Note:** No authentication required.

**Response:**
```json
{
  "success": true,
  "kandidat_saker": [
    {
      "sak_id": "SAK-20251218-001",
      "tittel": "KOE - Fundamentarbeid",
      "avslatte_dager": 14,
      "catenda_topic_id": "guid-123"
    }
  ]
}
```

---

### Create Forsering Case
`POST /api/forsering/opprett`

Create a new forsering case based on rejected deadline extensions.

**Request:**
```json
{
  "avslatte_sak_ids": ["SAK-20251218-001", "SAK-20251218-002"],
  "estimert_kostnad": 1200000,
  "dagmulktsats": 50000,
  "begrunnelse": "Iverksetter forsering iht. NS 8407 §33.8"
}
```

**30% Rule Validation:**
- `maks_kostnad = avslatte_dager × dagmulktsats × 1.3`
- `estimert_kostnad` must be ≤ `maks_kostnad`

---

### Validate 30% Rule
`POST /api/forsering/valider`

Check if estimated cost is within the 30% limit.

**Request:**
```json
{
  "estimert_kostnad": 1200000,
  "avslatte_dager": 24,
  "dagmulktsats": 50000
}
```

**Response:**
```json
{
  "success": true,
  "er_gyldig": true,
  "maks_kostnad": 1560000,
  "prosent_av_maks": 76.9
}
```

---

### Get Forsering Context
`GET /api/forsering/{sak_id}/kontekst`

Get complete context including related cases, states, and events.

---

## Endringsordre API (§31.3)

Endringsordre (change order) is the formal document confirming a contract change. It can aggregate multiple KOE cases.

### Get Candidate KOE Cases
`GET /api/endringsordre/kandidater`

Get KOE cases that can be added to an endringsordre.

**Note:** No authentication required.

**Response:**
```json
{
  "success": true,
  "kandidat_saker": [
    {
      "sak_id": "SAK-20251218-001",
      "tittel": "KOE - Fundamentarbeid",
      "overordnet_status": "OMFORENT",
      "sum_godkjent": 150000,
      "godkjent_dager": 10
    }
  ]
}
```

---

### Create Endringsordre Case
`POST /api/endringsordre/opprett`

Create a new endringsordre case.

**Request:**
```json
{
  "eo_nummer": "EO-001",
  "beskrivelse": "Samler endringskrav fra KOE-1 og KOE-2",
  "koe_sak_ids": ["SAK-20251218-001", "SAK-20251218-002"],
  "konsekvenser": {
    "sha": false,
    "kvalitet": false,
    "fremdrift": true,
    "pris": true,
    "annet": false
  },
  "kompensasjon_belop": 175000,
  "frist_dager": 7
}
```

---

### Get Endringsordre Context
`GET /api/endringsordre/{sak_id}/kontekst`

Get complete context including related KOE cases, states, and events.

---

### Add KOE to Endringsordre
`POST /api/endringsordre/{sak_id}/koe`

**Request:**
```json
{
  "koe_sak_id": "SAK-20251218-003"
}
```

---

### Remove KOE from Endringsordre
`DELETE /api/endringsordre/{sak_id}/koe/{koe_sak_id}`

---

## CloudEvents API

This API supports [CloudEvents v1.0](https://cloudevents.io/) format for event interoperability.

### CloudEvents Format

Events can be retrieved in CloudEvents format by setting the `Accept` header:

```
Accept: application/cloudevents+json
```

**Example CloudEvent:**
```json
{
  "specversion": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "source": "/projects/P-2025-001/cases/KOE-2025-042",
  "type": "no.oslo.koe.grunnlag_opprettet",
  "time": "2025-12-20T10:30:00Z",
  "subject": "KOE-2025-042",
  "datacontenttype": "application/json",
  "actor": "Ola Nordmann",
  "actorrole": "TE",
  "data": {
    "tittel": "Forsinket tegningsunderlag",
    "hovedkategori": "forsinkelse_bh",
    "beskrivelse": "..."
  }
}
```

**Extension Attributes:**
- `actor`: Name of person who performed the action
- `actorrole`: Role (TE=Totalentreprenør, BH=Byggherre)
- `referstoid`: Reference to another event ID (for responses)
- `comment`: Optional comment

---

### List Event Schemas
`GET /api/cloudevents/schemas`

List all available event types with their CloudEvents type names.

**Response:**
```json
{
  "namespace": "no.oslo.koe",
  "specversion": "1.0",
  "event_types": [
    {
      "event_type": "grunnlag_opprettet",
      "cloudevents_type": "no.oslo.koe.grunnlag_opprettet",
      "schema_url": "/api/cloudevents/schemas/grunnlag_opprettet",
      "has_data_schema": true
    }
  ]
}
```

---

### Get Event Data Schema
`GET /api/cloudevents/schemas/{event_type}`

Get JSON Schema for a specific event type's data payload.

**Response (Content-Type: application/schema+json):**
```json
{
  "$id": "no.oslo.koe/grunnlag_opprettet/data",
  "title": "GrunnlagData",
  "type": "object",
  "properties": {
    "tittel": { "type": "string" },
    "hovedkategori": { "type": "string" }
  }
}
```

---

### Get CloudEvents Envelope Schema
`GET /api/cloudevents/envelope-schema`

Get JSON Schema for the CloudEvents envelope structure.

Query params:
- `format=jsonschema` (default) - Full JSON Schema
- `format=openapi` - OpenAPI 3.0 compatible schema

---

### Get All Schemas
`GET /api/cloudevents/all-schemas`

Get envelope schema and all data schemas in a single response.
Useful for caching.

**Response:**
```json
{
  "namespace": "no.oslo.koe",
  "specversion": "1.0",
  "envelope": { ... },
  "data_schemas": {
    "grunnlag_opprettet": { ... },
    "vederlag_krav_sendt": { ... }
  }
}
```
