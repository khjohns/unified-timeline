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

**Required data fields:**
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
