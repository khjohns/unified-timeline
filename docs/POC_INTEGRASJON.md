# POC Integrasjonsplan: React App + Python Backend

## Oversikt

Denne dokumentasjonen beskriver hvordan React-appen og Python-backend skal settes sammen for POC-demonstrasjonen med Catenda-integrasjon.

---

## Arkitektur

```
┌─────────────────┐     Webhook      ┌─────────────────┐
│     Catenda     │ ───────────────> │  Python Backend │
│   (Prosjekt-    │                  │   (Flask:8080)  │
│    hotell)      │ <─────────────── │   (port 8080)   │
└─────────────────┘   API (comment,  └────────┬────────┘
                      document)               │
                                              │ REST API
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
```

---

## React App Status

### Implementert (Klar)
- [x] URL-parameterhåndtering (`sakId`, `modus`, `topicGuid`)
- [x] API service med alle endepunkter
- [x] Modushåndtering (varsel/koe/svar/revidering)
- [x] Loading og error states
- [x] Automatisk rollebytte basert på modus
- [x] Send-knapp med riktig tekst per modus
- [x] PDF-generering med @react-pdf/renderer

### Mangler (Må implementeres)
- [ ] **PDF-opplasting til backend** - Etter generering må PDF sendes til backend
- [ ] Returnere sakId fra API-respons til URL (valgfritt)

---

## Dataflyt: Komplett arbeidsflyt

### Steg 1: Topic opprettes i Catenda
```
Catenda → POST /webhook/catenda → Python Backend
```
**Backend må:**
- Motta webhook med `event_type: "topic.created"`
- Opprette sak i CSV-database
- Generere sakId (f.eks. `KOE-20231119-1200`)
- Poste kommentar til Catenda med lenke til React app

### Steg 2: Entreprenør fyller ut varsel
```
React App (?sakId=X&modus=varsel) → POST /api/varsel-submit → Backend
```
**Backend må:**
- Lagre formData i database
- Poste kommentar til Catenda: "Varsel mottatt"
- Returnere lenke for neste steg (koe)

### Steg 3: Entreprenør sender krav (KOE)
```
React App (?sakId=X&modus=koe) → POST /api/koe-submit → Backend
React App → POST /api/cases/{sakId}/pdf → Backend → Catenda Document API
```
**Backend må:**
- Lagre formData
- Motta PDF fra React app (base64)
- Laste opp PDF til Catenda Document Library
- Poste kommentar: "KOE mottatt - PDF vedlagt"

### Steg 4: Byggherre svarer
```
React App (?sakId=X&modus=svar) → POST /api/svar-submit → Backend
React App → POST /api/cases/{sakId}/pdf → Backend → Catenda
```
**Backend må:**
- Lagre BH-svar
- Motta og laste opp PDF
- Poste kommentar med status (godkjent/avslått/etc.)

### Steg 5: Eventuell revidering
```
React App (?sakId=X&modus=revidering) → POST /api/cases/{sakId}/revidering
```
Samme flyt som steg 3, men med revisjonsnummer.

---

## Backend Sjekkliste

### Påkrevde API-endepunkter

| Endepunkt | Metode | Beskrivelse | React kaller |
|-----------|--------|-------------|--------------|
| `/api/health` | GET | Helsesjekk | `api.healthCheck()` |
| `/api/cases/{sakId}` | GET | Hent sak | `api.getCase()` |
| `/api/varsel-submit` | POST | Send varsel | `api.submitVarsel()` |
| `/api/koe-submit` | POST | Send krav | `api.submitKoe()` |
| `/api/svar-submit` | POST | Send svar | `api.submitSvar()` |
| `/api/cases/{sakId}/revidering` | POST | Send revisjon | `api.submitRevidering()` |
| `/api/cases/{sakId}/pdf` | POST | Motta PDF | `api.uploadPdf()` |
| `/api/cases/{sakId}/draft` | PUT | Lagre utkast | `api.saveDraft()` |
| `/webhook/catenda` | POST | Webhook | Catenda |

### Request/Response Format

#### POST /api/koe-submit
**Request:**
```json
{
  "formData": { /* Full FormDataModel */ },
  "sakId": "KOE-20231119-1200",  // Kan være null for ny sak
  "topicGuid": "abc-123-def",
  "modus": "koe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sakId": "KOE-20231119-1200",
    "topicGuid": "abc-123-def",
    "status": "krav_sendt",
    "message": "Krav registrert"
  }
}
```

#### POST /api/cases/{sakId}/pdf
**Request:**
```json
{
  "pdfBase64": "JVBERi0xLjQK...",
  "filename": "KOE-20231119-1200_rev0.pdf",
  "modus": "koe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "documentGuid": "catenda-doc-guid",
    "filename": "KOE-20231119-1200_rev0.pdf",
    "message": "PDF lastet opp til Catenda"
  }
}
```

### Catenda API-funksjoner backend må ha

1. **post_comment(topic_guid, text)**
   - Poster kommentar til BCF topic
   - Inkluderer lenker til React app

2. **upload_document(topic_guid, filename, file_content)**
   - Laster opp PDF til Document Library
   - Kobler til riktig topic
   - Returnerer document_guid

3. **get_topic(topic_guid)** (valgfritt)
   - Henter topic-info for validering

### Database-struktur (CSV)

**saker.csv:**
```csv
sak_id,topic_guid,status,modus,created_at,updated_at
KOE-20231119-1200,abc-123,krav_sendt,koe,2023-11-19T12:00:00,2023-11-19T14:30:00
```

**form_data/{sak_id}.json:**
```json
{
  "versjon": "5.0",
  "rolle": "TE",
  "sak": { ... },
  "varsel": { ... },
  "koe_revisjoner": [ ... ],
  "bh_svar_revisjoner": [ ... ]
}
```

**historikk.csv:**
```csv
sak_id,timestamp,event,description
KOE-20231119-1200,2023-11-19T12:00:00,topic_created,Sak opprettet fra Catenda
KOE-20231119-1200,2023-11-19T14:30:00,krav_sendt,KOE sendt av entreprenør
```

---

## Konfigurasjon

### React App (.env.local)
```bash
VITE_API_BASE_URL=http://localhost:8080/api
# Eller med ngrok:
# VITE_API_BASE_URL=https://your-subdomain.ngrok.io/api
```

### Backend (config.json)
```json
{
  "catenda": {
    "client_id": "your-client-id",
    "client_secret": "your-client-secret",
    "project_id": "your-project-id"
  },
  "react_app_url": "https://khjohns.github.io/Skjema_Endringsmeldinger",
  "data_dir": "./data"
}
```

---

## Implementeringsrekkefølge

### Fase 1: Grunnleggende kommunikasjon
1. [ ] Start backend på port 8080
2. [ ] Verifiser `/api/health` fungerer
3. [ ] Test at React app kan koble til (sjekk "Send"-knapp vises)

### Fase 2: Skjemainnsending
1. [ ] Implementer `/api/koe-submit` i backend
2. [ ] Test innsending fra React app
3. [ ] Verifiser data lagres i CSV/JSON

### Fase 3: PDF-håndtering
1. [ ] Implementer `/api/cases/{sakId}/pdf` i backend
2. [ ] Test PDF-opplasting fra React app
3. [ ] Verifiser PDF lagres lokalt

### Fase 4: Catenda-integrasjon
1. [ ] Konfigurer Catenda API-credentials
2. [ ] Implementer kommentar-posting
3. [ ] Implementer document upload
4. [ ] Test webhook-mottak

### Fase 5: Komplett flyt
1. [ ] Test topic.created webhook → lenke genereres
2. [ ] Test varsel → koe → svar syklus
3. [ ] Verifiser PDF-er dukker opp i Catenda
4. [ ] Test revidering-flyt

---

## Feilsøking

### React app viser ikke "Send"-knapp
- Sjekk at backend kjører på riktig port
- Sjekk CORS er aktivert i backend
- Sjekk `VITE_API_BASE_URL` i .env.local

### PDF lastes ikke opp til Catenda
- Sjekk Catenda API-credentials
- Verifiser topic_guid er korrekt
- Sjekk Document Library-tilgang

### Webhook mottas ikke
- Verifiser ngrok tunnel kjører
- Sjekk webhook-URL i Catenda-innstillinger
- Se backend-logger for innkommende requests

---

## Viktige merknader

1. **PDF genereres av React** - Backend skal IKKE generere PDF (fjern reportlab-kode)
2. **React-PDF bruker Oslo Sans** - Fonts må være tilgjengelig i public/fonts
3. **Base64-encoding** - PDF sendes som base64-string til backend
4. **Filnavn-konvensjon** - `{sakId}_rev{nummer}.pdf`
5. **CORS** - Backend må ha `flask-cors` installert og aktivert

---

## Neste steg

Etter at denne integrasjonen fungerer:
1. Deploy backend til skyplattform (Render, Railway, etc.)
2. Konfigurer permanent webhook-URL i Catenda
3. Implementer autentisering/autorisasjon
4. Legg til e-postvarsling
