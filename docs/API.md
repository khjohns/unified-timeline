# API-dokumentasjon

Backend API-referanse for Skjema Endringsmeldinger.

---

## Innhold

- [Oversikt](#oversikt)
- [Autentisering](#autentisering)
- [Endepunkter](#endepunkter)
  - [Utility](#utility)
  - [Cases](#cases)
  - [Varsel](#varsel)
  - [KOE](#koe)
  - [Svar](#svar)
  - [Webhooks](#webhooks)
- [Feilhåndtering](#feilhåndtering)
- [Statuskoder](#statuskoder)

---

## Oversikt

### Base URL

| Miljø | URL |
|-------|-----|
| Utvikling | `http://localhost:8080/api` |
| Produksjon | `https://<azure-function>.azurewebsites.net/api` |

### Content-Type

Alle requests og responses bruker `application/json`.

### Arkitektur

```
Frontend ──▶ API Routes ──▶ Services ──▶ Repositories ──▶ Database
                │
                └──▶ Catenda API (ekstern)
```

---

## Autentisering

### CSRF-beskyttelse

Alle state-changing operasjoner (POST, PUT, DELETE) krever CSRF-token.

**Flyt:**
1. Frontend henter token via `GET /api/csrf-token`
2. Token inkluderes i `X-CSRF-Token` header på påfølgende requests

```javascript
// Eksempel: Hent CSRF-token
const response = await fetch('/api/csrf-token');
const { csrfToken } = await response.json();

// Eksempel: Bruk i request
await fetch('/api/varsel-submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify(data)
});
```

### Magic Links

For eksterne brukere (entreprenører) brukes magic links i stedet for innlogging:

1. Catenda-kommentar inneholder lenke med `magicToken`
2. Frontend verifiserer token via `GET /api/magic-link/verify?token=...`
3. Ved gyldig token returneres `sakId` for å laste saken

**Token-levetid:** Konfigurerbar, typisk 7 dager.

---

## Endepunkter

### Utility

#### `GET /api/health`

Helsesjekk for backend.

**Response:**
```json
{
  "status": "healthy",
  "service": "koe-backend"
}
```

---

#### `GET /api/csrf-token`

Hent CSRF-token for beskyttelse av state-changing requests.

**Response:**
```json
{
  "csrfToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `csrfToken` | string | JWT-token for CSRF-beskyttelse |
| `expiresIn` | number | Sekunder til token utløper |

---

#### `GET /api/magic-link/verify`

Verifiser magic link token og få sakId.

**Query Parameters:**
| Parameter | Type | Påkrevd | Beskrivelse |
|-----------|------|---------|-------------|
| `token` | string | Ja | Magic link token fra URL |

**Response (suksess):**
```json
{
  "success": true,
  "sakId": "KOE-2024-001"
}
```

**Response (feil):**
```json
{
  "error": "Invalid or expired link",
  "detail": "Token has expired"
}
```

---

#### `POST /api/validate-user`

Valider at en e-postadresse tilhører en bruker i Catenda-prosjektet.

**Request Body:**
```json
{
  "email": "bruker@firma.no",
  "sakId": "KOE-2024-001"
}
```

**Response (suksess):**
```json
{
  "success": true,
  "name": "Ola Nordmann",
  "email": "bruker@firma.no",
  "company": "Byggfirma AS"
}
```

**Response (ikke funnet):**
```json
{
  "success": false,
  "error": "Brukeren er ikke medlem i dette Catenda-prosjektet."
}
```

---

### Cases

#### `GET /api/cases/{sakId}`

Hent saksdetaljer inkludert alle skjemadata.

**Path Parameters:**
| Parameter | Type | Beskrivelse |
|-----------|------|-------------|
| `sakId` | string | Unik saksidentifikator |

**Response:**
```json
{
  "sakId": "KOE-2024-001",
  "topicGuid": "abc123-def456-...",
  "status": "Under behandling",
  "formData": {
    "sak": {
      "saksnummer": "KOE-2024-001",
      "prosjekt_navn": "Skolebygg X",
      "entreprenor": "Byggfirma AS",
      "byggherre": "Oslobygg KF",
      "status": "varsel_sendt",
      "catenda_project_id": "project-123",
      "catenda_topic_id": "abc123-def456-..."
    },
    "varsel": {
      "dato_oppdaget": "2024-01-15",
      "dato_varsel_sendt": "2024-01-16",
      "varsel_metode": "beskrivelse_endret",
      "varsel_kategori": "grunnforhold",
      "beskrivelse": "Uventede grunnforhold..."
    },
    "koe_revisjoner": [...],
    "bh_svar_revisjoner": [...]
  }
}
```

---

#### `PUT /api/cases/{sakId}/draft`

Lagre utkast (auto-save funksjonalitet).

**Path Parameters:**
| Parameter | Type | Beskrivelse |
|-----------|------|-------------|
| `sakId` | string | Unik saksidentifikator |

**Request Body:**
```json
{
  "formData": {
    "sak": {...},
    "varsel": {...},
    "koe_revisjoner": [...],
    "bh_svar_revisjoner": [...]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Utkast lagret"
}
```

---

### Varsel

#### `POST /api/varsel-submit`

Send varsel om endringsforhold (steg 1 i arbeidsflyten).

**Headers:**
| Header | Påkrevd | Beskrivelse |
|--------|---------|-------------|
| `X-CSRF-Token` | Ja | CSRF-token fra `/api/csrf-token` |

**Request Body:**
```json
{
  "sakId": "KOE-2024-001",
  "topicGuid": "abc123-def456-...",
  "formData": {
    "sak": {...},
    "varsel": {
      "dato_oppdaget": "2024-01-15",
      "varsel_metode": "beskrivelse_endret",
      "varsel_kategori": "grunnforhold",
      "beskrivelse": "Beskrivelse av forholdet...",
      "referanse_til_kontrakt": "Pkt. 3.2.1"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "nextMode": "koe"
}
```

**Business Logic:**
1. Auto-populerer `dato_varsel_sendt` med dagens dato
2. Lagrer formData til database
3. Oppretter tom KOE-revisjon (hvis ikke finnes)
4. Logger hendelse til historikk
5. Poster kommentar til Catenda med magic link

---

### KOE

#### `POST /api/koe-submit`

Send krav om endringsordre (steg 2 i arbeidsflyten).

**Headers:**
| Header | Påkrevd | Beskrivelse |
|--------|---------|-------------|
| `X-CSRF-Token` | Ja | CSRF-token |

**Request Body:**
```json
{
  "sakId": "KOE-2024-001",
  "topicGuid": "abc123-def456-...",
  "formData": {
    "sak": {...},
    "varsel": {...},
    "koe_revisjoner": [{
      "koe_revisjonsnr": "0",
      "vederlag": {
        "krav_vederlag": true,
        "krav_vederlag_metode": "regningsarbeid",
        "krav_vederlag_belop": "150000",
        "krav_vederlag_begrunnelse": "Ekstraarbeid..."
      },
      "frist": {
        "krav_fristforlengelse": true,
        "krav_frist_type": "deltidsfrist",
        "krav_frist_antall_dager": "14",
        "krav_frist_begrunnelse": "Forsinkelse pga..."
      }
    }]
  }
}
```

**Response:**
```json
{
  "success": true,
  "nextMode": "svar"
}
```

**Business Logic:**
1. Auto-populerer `dato_krav_sendt` og `for_entreprenor`
2. Lagrer formData
3. Oppretter tom BH svar-revisjon (hvis ikke finnes)
4. Logger hendelse
5. Poster kommentar til Catenda med kravdetaljer og magic link

---

#### `POST /api/cases/{sakId}/revidering`

Send revidert KOE etter delvis avslag fra byggherre.

**Path Parameters:**
| Parameter | Type | Beskrivelse |
|-----------|------|-------------|
| `sakId` | string | Saksidentifikator |

**Request Body:**
```json
{
  "formData": {
    "koe_revisjoner": [
      {...},  // Revisjon 0 (original)
      {       // Revisjon 1 (revidert)
        "koe_revisjonsnr": "1",
        "vederlag": {...},
        "frist": {...}
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "nextMode": "svar"
}
```

---

#### `POST /api/cases/{sakId}/pdf`

Last opp PDF-dokument til Catenda.

**Path Parameters:**
| Parameter | Type | Beskrivelse |
|-----------|------|-------------|
| `sakId` | string | Saksidentifikator |

**Request Body:**
```json
{
  "pdfBase64": "JVBERi0xLjQKJeLjz9...",
  "filename": "KOE-2024-001_v1.pdf",
  "topicGuid": "abc123-def456-..."
}
```

**Response (suksess):**
```json
{
  "success": true,
  "documentId": "doc-789",
  "revision": 1
}
```

**Response (feil):**
```json
{
  "success": false,
  "error": "Failed to upload PDF to Catenda"
}
```

---

### Svar

#### `POST /api/svar-submit`

Send byggherre-svar på KOE (steg 3 i arbeidsflyten).

**Headers:**
| Header | Påkrevd | Beskrivelse |
|--------|---------|-------------|
| `X-CSRF-Token` | Ja | CSRF-token |

**Request Body:**
```json
{
  "sakId": "KOE-2024-001",
  "topicGuid": "abc123-def456-...",
  "formData": {
    "bh_svar_revisjoner": [{
      "vederlag": {
        "bh_svar_vederlag": "godkjent",
        "bh_godkjent_vederlag_belop": "140000",
        "bh_begrunnelse_vederlag": "Godkjent med reduksjon..."
      },
      "frist": {
        "bh_svar_frist": "godkjent",
        "bh_godkjent_frist_dager": "10",
        "bh_begrunnelse_frist": "Redusert fra 14 til 10 dager"
      }
    }]
  }
}
```

**Response:**
```json
{
  "success": true
}
```

**Business Logic:**
1. Auto-populerer `dato_svar_bh` og `for_byggherre`
2. Sjekker om revisjon kreves basert på svar
3. Hvis revisjon kreves: oppretter ny KOE-revisjon og BH svar-template
4. Lagrer formData
5. Poster kommentar til Catenda med beslutningsdetaljer

---

### Webhooks

#### `POST /webhook/catenda/{secret_path}`

Motta webhook-events fra Catenda.

**Path Parameters:**
| Parameter | Type | Beskrivelse |
|-----------|------|-------------|
| `secret_path` | string | Hemmelig path fra miljøvariabel |

**Støttede Event-typer:**

| Event Type | Beskrivelse |
|------------|-------------|
| `issue.created` | Ny topic opprettet |
| `bcf.issue.created` | Ny BCF topic opprettet |
| `issue.modified` | Topic endret |
| `bcf.comment.created` | Ny kommentar lagt til |
| `issue.status.changed` | Status endret |

**Request Body (eksempel):**
```json
{
  "event": {
    "type": "issue.created",
    "id": "event-12345"
  },
  "issue": {
    "guid": "abc123-def456-...",
    "title": "KOE: Grunnforhold",
    "status": "Open"
  },
  "project": {
    "id": "project-123"
  }
}
```

**Responses:**

| Status | Body | Beskrivelse |
|--------|------|-------------|
| 200 | `{"status": "created", ...}` | Ny sak opprettet |
| 200 | `{"status": "updated", ...}` | Sak oppdatert |
| 200 | `{"status": "ignored", ...}` | Ukjent event-type (ignorert) |
| 202 | `{"status": "already_processed"}` | Duplikat event (idempotency) |
| 400 | `{"error": "..."}` | Ugyldig payload |

**Sikkerhet:**
- Secret path i URL
- Idempotency-sjekk (forhindrer duplikat-prosessering)
- Event structure validation

---

## Feilhåndtering

### HTTP Statuskoder

| Kode | Betydning |
|------|-----------|
| 200 | Suksess |
| 202 | Akseptert (f.eks. duplikat webhook) |
| 400 | Ugyldig request (manglende felt, feil format) |
| 403 | Forbudt (ugyldig CSRF-token eller magic link) |
| 404 | Ressurs ikke funnet |
| 429 | Rate limit overskredet |
| 500 | Intern serverfeil |

### Feilresponser

Alle feil returneres med `error`-felt:

```json
{
  "error": "Beskrivelse av feilen",
  "detail": "Ytterligere detaljer (valgfritt)"
}
```

### Rate Limiting

| Endepunkt-gruppe | Grense |
|------------------|--------|
| Submit-endepunkter | 10/minutt |
| Webhooks | 100/minutt |
| Øvrige | 60/minutt |

Ved overskredet grense returneres `429 Too Many Requests`.

---

## Statuskoder

Statuskoder defineres i `shared/status-codes.json` og brukes av både frontend og backend.

### Sak-statuser

| Kode | Beskrivelse |
|------|-------------|
| `ny` | Ny sak (ikke påbegynt) |
| `varsel_under_utfylling` | Varsel under utfylling |
| `varslet` | Varsel sendt |
| `koe_under_utfylling` | KOE under utfylling |
| `koe_sendt` | KOE sendt til byggherre |
| `svar_under_utfylling` | BH svar under utfylling |
| `besvart` | BH har svart |
| `venter_revisjon` | Venter på revidert krav |
| `eo_utstedt` | Endringsordre utstedt |
| `lukket` | Sak lukket |

### KOE-statuser

| Kode | Beskrivelse |
|------|-------------|
| `utkast` | Under utfylling |
| `sendt_til_bh` | Sendt til byggherre |
| `besvart` | Besvart av byggherre |
| `tilbakekalt` | Tilbakekalt av entreprenør |

### BH Svar-statuser

| Kode | Beskrivelse |
|------|-------------|
| `utkast` | Under utfylling |
| `godkjent` | Fullt godkjent |
| `delvis_godkjent` | Delvis godkjent |
| `avslaatt` | Avslått |
| `til_forhandling` | Sendt til forhandlingsmøte |
| `til_tvistelosning` | Sendt til tvisteløsning |

---

## Eksempler

### Komplett arbeidsflyt

```javascript
// 1. Hent CSRF-token
const csrf = await fetch('/api/csrf-token').then(r => r.json());

// 2. Hent sak via magic link
const verify = await fetch('/api/magic-link/verify?token=xyz');
const { sakId } = await verify.json();

// 3. Last saksdata
const caseData = await fetch(`/api/cases/${sakId}`).then(r => r.json());

// 4. Send varsel
await fetch('/api/varsel-submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrf.csrfToken
  },
  body: JSON.stringify({
    sakId,
    topicGuid: caseData.topicGuid,
    formData: caseData.formData
  })
});

// 5. Send KOE
await fetch('/api/koe-submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrf.csrfToken
  },
  body: JSON.stringify({
    sakId,
    topicGuid: caseData.topicGuid,
    formData: updatedFormData
  })
});

// 6. Last opp PDF
await fetch(`/api/cases/${sakId}/pdf`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pdfBase64: 'JVBERi0...',
    filename: `${sakId}_v1.pdf`,
    topicGuid: caseData.topicGuid
  })
});
```

---

## Se også

- [GETTING_STARTED.md](GETTING_STARTED.md) – Oppsett av utviklingsmiljø
- [backend/STRUCTURE.md](../backend/STRUCTURE.md) – Backend-arkitektur
- [HLD - Overordnet Design.md](HLD%20-%20Overordnet%20Design.md) – Systemarkitektur
