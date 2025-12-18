# Full Flow Test Plan - Catenda Integration

**Opprettet:** 2025-12-18
**Status:** Plan godkjent, klar for implementering

---

## Innhold

1. [Oversikt](#oversikt)
2. [Forutsetninger](#forutsetninger)
3. [Topic Board Konfigurasjon](#topic-board-konfigurasjon)
4. [Fase 1: Setup og validering](#fase-1-setup-og-validering)
5. [Fase 2: Test standard KOE-flyt](#fase-2-test-standard-koe-flyt)
6. [Fase 3: Utvidelser (senere)](#fase-3-utvidelser-senere)
7. [Implementasjonsdetaljer](#implementasjonsdetaljer)
8. [Filer som må endres/opprettes](#filer-som-må-endresopprettes)

---

## Oversikt

Et interaktivt script som tester den komplette flyten fra topic-opprettelse i Catenda til ferdig behandlet sak med PDF-arkivering. Scriptet tester mot ekte Catenda API og backend.

### Mål

- Verifisere at hele integrasjonen fungerer ende-til-ende
- Dokumentere og validere Topic Board-konfigurasjon
- Gi utviklere et verktøy for å teste endringer

### Scope

**Fase 1 (denne planen):** Standard KOE-flyt (Krav om endringsordre)
**Fase 2 (senere):** Endringsordre-flyt
**Fase 3 (senere):** Forsering-flyt

---

## Forutsetninger

### Tekniske krav

- Python 3.10+
- Backend kjørende på `localhost:8080`
- Gyldig Catenda-autentisering (access token)
- ngrok eller ekstern URL for webhook-mottak

### Catenda-tilgang

- Prosjekt med skrivetilgang
- Document Library opprettet
- Topic Board opprettet med riktig konfigurasjon (se under)

---

## Topic Board Konfigurasjon

For at integrasjonen skal fungere, må Topic Board i Catenda ha følgende oppsett:

### Topic Types (3 stk)

| Type | Beskrivelse | Frontend-ruting |
|------|-------------|-----------------|
| `Krav om endringsordre` | Standard KOE-sak (§33/§34) | `/saker/{sak_id}` (CasePage) |
| `Endringsordre` | EO fra byggherre (§31.3) | `/endringsordre/{sak_id}` |
| `Forsering` | Akselerasjonssak (§33.8) | `/forsering/{sak_id}` |

### Statuses (6 stk)

Disse matcher `overordnet_status` fra TimelineService:

| Status | Type | Beskrivelse |
|--------|------|-------------|
| `Under varsling` | open | Sak opprettet, grunnlag ikke sendt |
| `Sendt` | open | Minst ett spor sendt, venter på BH |
| `Under behandling` | open | BH har svart på minst ett spor |
| `Under forhandling` | open | BH avslått/delvis godkjent noe |
| `Omforent` | closed | Alle aktive spor godkjent |
| `Lukket` | closed | Saken er avsluttet |

### Custom Fields (2 stk)

| Felt | Type | Påkrevd | Beskrivelse |
|------|------|---------|-------------|
| `Byggherre` | text | Nei | Navn på byggherre |
| `Leverandør` | text | Nei | Navn på entreprenør/leverandør |

**Merk:** Flere custom fields kan legges til ved behov (f.eks. beløp, dager).

### Webhook-konfigurasjon

Følgende webhooks må være aktive for prosjektet:

| Event | Beskrivelse |
|-------|-------------|
| `issue.created` | Trigger når ny topic opprettes |
| `issue.modified` | Trigger ved endringer (kommentarer, etc.) |
| `issue.status.changed` | Trigger ved statusendring |

**Target URL:** `{NGROK_URL}/webhook/catenda/{WEBHOOK_SECRET_PATH}`

---

## Fase 1: Setup og validering

### Steg 1.1: Autentiseringssjekk

**Fil:** `scripts/setup_authentication.py` (utvides)

1. Sjekk om gyldig access token finnes i `.env`
2. Hvis ikke: Kjør eksisterende autentiseringsflyt
3. **Nytt:** Bruk Project API til å liste tilgjengelige prosjekter
4. **Nytt:** Vis liste med forhåndsvalgt prosjekt fra `.env`
5. Bruker bekrefter eller velger annet prosjekt

```
📂 Tilgjengelige prosjekter:
  1. [*] Testprosjekt Alpha (fra .env)
  2. [ ] Prosjekt Beta
  3. [ ] Prosjekt Gamma

Velg prosjekt [1]:
```

### Steg 1.2: Bibliotek og mappe

1. Les `CATENDA_LIBRARY_ID` og `CATENDA_FOLDER_ID` fra `.env`
2. Vis informasjon om valgt bibliotek/mappe
3. Bruker bekrefter at dette er riktig

```
📚 Document Library
   Library ID: abc-123
   Folder ID: def-456 (valgfri)

Er dette riktig? [j/n]:
```

### Steg 1.3: Topic Board validering

1. Hent Topic Board-detaljer fra API
2. Valider at nødvendige **Types** finnes
3. Valider at nødvendige **Statuses** finnes
4. Valider at nødvendige **Custom Fields** er aktivert
5. Vis mangler og instruksjoner for oppsett

```
🎯 Topic Board: "KOE Board"
   Board ID: xyz-789

✅ Types:
   - Krav om endringsordre
   - Endringsordre
   - Forsering

✅ Statuses:
   - Under varsling (open)
   - Sendt (open)
   - Under behandling (open)
   - Under forhandling (open)
   - Omforent (closed)
   - Lukket (closed)

✅ Custom Fields:
   - Byggherre (text)
   - Leverandør (text)

Alt OK! Fortsett? [j/n]:
```

**Ved mangler:**

```
❌ Manglende konfigurasjon:

Types som mangler:
   - Forsering

Statuses som mangler:
   - Under forhandling
   - Omforent

Instruksjoner:
   1. Gå til Catenda → Project Settings → Topic Board
   2. Legg til manglende types/statuses
   3. Kjør scriptet på nytt

Eller: Vil du at scriptet oppretter disse automatisk? [j/n]:
```

### Steg 1.4: Webhook-validering

1. List eksisterende webhooks for prosjektet
2. Sjekk at nødvendige webhooks er konfigurert
3. Sjekk at target URL matcher forventet (ngrok)
4. Vis status og eventuelle mangler

```
🔔 Webhooks:
   ✅ issue.created → https://abc.ngrok.io/webhook/catenda/secret123
   ✅ issue.modified → https://abc.ngrok.io/webhook/catenda/secret123
   ❌ issue.status.changed → MANGLER

Vil du opprette manglende webhooks? [j/n]:
```

---

## Fase 2: Test standard KOE-flyt

### Steg 2.1: Opprett topic i Catenda

1. Script oppretter ny topic med:
   - **Type:** `Krav om endringsordre`
   - **Title:** `TEST-{timestamp} - Automatisk testcase`
   - **Description:** Testbeskrivelse
   - **Custom fields:** Byggherre, Leverandør (hardkodet testverdier)

```
🆕 Oppretter test-topic i Catenda...
   Type: Krav om endringsordre
   Title: TEST-20251218-143052 - Automatisk testcase

✅ Topic opprettet!
   GUID: abc-123-def-456
   URL: https://catenda.com/projects/.../topics/...
```

### Steg 2.2: Verifiser webhook-mottak

1. Vent på at backend mottar webhook (timeout 30 sek)
2. Sjekk at `SakOpprettetEvent` ble persistert
3. Hent sak_id fra backend

```
⏳ Venter på webhook...
✅ Webhook mottatt!
   Sak ID: SAK-20251218-143052
   Event: sak_opprettet
```

### Steg 2.3: Verifiser magic link-kommentar

1. Hent kommentarer fra topic
2. Verifiser at kommentar med magic link ble postet
3. Vis magic link URL

```
💬 Sjekker kommentarer på topic...
✅ Magic link-kommentar funnet!
   URL: http://localhost:3000/saker/SAK-20251218-143052?magicToken=xyz
```

### Steg 2.4: Send grunnlag (simuler TE)

1. Script sender `grunnlag_opprettet` event til backend API
2. Hardkodede testverdier:
   - Hovedkategori: `ENDRING`
   - Underkategori: `INSTRUKS`
   - Beskrivelse: "Test av automatisk flyt"

```
📋 Sender grunnlag...
   Hovedkategori: ENDRING
   Underkategori: INSTRUKS

✅ Grunnlag registrert!
   Event: grunnlag_opprettet
   Versjon: 2
```

### Steg 2.5: Verifiser PDF-generering og opplasting

1. Sjekk at PDF ble generert
2. Sjekk at PDF ble lastet opp til Catenda library
3. Sjekk at dokumentreferanse ble opprettet på topic

```
📄 Sjekker PDF...
✅ PDF generert og lastet opp!
   Filnavn: SAK-20251218-143052_grunnlag.pdf
   Document GUID: doc-abc-123
   Lenket til topic: ✅
```

### Steg 2.6: Verifiser statuskommentar

1. Hent kommentarer fra topic
2. Verifiser at statuskommentar ble postet
3. Vis kommentarinnhold

```
💬 Sjekker statuskommentar...
✅ Statuskommentar funnet!
   "📋 Grunnlag opprettet
    Status: SENDT
    Neste steg: 🏢 BH må svare på grunnlag"
```

### Steg 2.7: Send vederlag og frist (simuler TE)

1. Script sender `vederlag_krav_sendt` event
2. Script sender `frist_krav_sendt` event
3. Verifiser state-oppdatering

```
💰 Sender vederlagskrav...
   Metode: DIREKTE
   Beløp: 150000 kr

⏰ Sender fristkrav...
   Antall dager: 14

✅ Krav registrert!
   Overordnet status: SENDT
```

### Steg 2.8: Vis oppsummering

```
═══════════════════════════════════════════════════════════════
  ✅ TEST FULLFØRT - Standard KOE-flyt
═══════════════════════════════════════════════════════════════

Sak ID: SAK-20251218-143052
Topic GUID: abc-123-def-456
Catenda URL: https://catenda.com/...

Status: SENDT (venter på BH-respons)

Events registrert:
  1. sak_opprettet
  2. grunnlag_opprettet
  3. vederlag_krav_sendt
  4. frist_krav_sendt

Dokumenter:
  - SAK-20251218-143052_grunnlag.pdf ✅

Neste steg:
  BH må manuelt svare på grunnlag, vederlag og frist
  i frontend-applikasjonen.

═══════════════════════════════════════════════════════════════
```

### Steg 2.9: Cleanup (valgfritt)

```
🗑️  Vil du rydde opp testdata? [j/n]:

Dette vil:
  - Slette topic fra Catenda
  - Slette events fra backend
  - Slette opplastede dokumenter

Bekreft sletting [j/n]:
```

---

## Fase 3: Utvidelser (senere)

### 3.1 Endringsordre-flyt

- Opprett topic med type `Endringsordre`
- Verifiser ruting til `/endringsordre/{sak_id}`
- Test EO-spesifikke events

### 3.2 Forsering-flyt

- Opprett topic med type `Forsering`
- Verifiser ruting til `/forsering/{sak_id}`
- Test forsering-spesifikke events og 30%-regel

### 3.3 Relasjoner mellom saker

- Opprett flere KOE-saker
- Test toveis-relasjoner
- Test EO som samler KOE-saker
- Test forsering som refererer avslåtte fristkrav

---

## Implementasjonsdetaljer

### Backend-endepunkter som brukes

| Endepunkt | Metode | Beskrivelse |
|-----------|--------|-------------|
| `/api/events` | POST | Registrer event |
| `/api/cases/{sak_id}/state` | GET | Hent sak-state |
| `/api/cases/{sak_id}/events` | GET | Hent events for sak |
| `/webhook/catenda/{secret}` | POST | Motta Catenda webhook |

### Catenda API-endepunkter som brukes

| Endepunkt | Metode | Beskrivelse |
|-----------|--------|-------------|
| `/v2/projects` | GET | Liste prosjekter |
| `/v2/projects/{id}/webhooks/user` | GET/POST | Webhooks |
| `/opencde/bcf/3.0/projects/{id}/topics` | GET/POST | Topics |
| `/opencde/bcf/3.0/.../topics/{id}/comments` | GET/POST | Kommentarer |
| `/opencde/bcf/3.0/.../extensions` | GET | Board extensions |
| `/v2/projects/{id}/libraries/{id}/items` | POST | Last opp dokument |

### Testverdier (hardkodet)

```python
TEST_DATA = {
    "byggherre": "Test Byggherre AS",
    "leverandor": "Test Entreprenør AS",
    "grunnlag": {
        "hovedkategori": "ENDRING",
        "underkategori": "INSTRUKS",
        "beskrivelse": "Automatisk testcase - grunnlag",
        "kontraktsreferanse": "§31.1"
    },
    "vederlag": {
        "metode": "DIREKTE",
        "belop": 150000.0,
        "beskrivelse": "Automatisk testcase - vederlag"
    },
    "frist": {
        "varseltype": "SPESIFIKT",
        "antall_dager": 14,
        "beskrivelse": "Automatisk testcase - frist"
    }
}
```

---

## Filer som må endres/opprettes

### Nye filer

| Fil | Beskrivelse |
|-----|-------------|
| `scripts/test_full_flow.py` | Hovedscript for full flyt-test |

### Filer som utvides

| Fil | Endring |
|-----|---------|
| `scripts/setup_authentication.py` | Legg til Project API for prosjektlisting |
| `utils/filtering_config.py` | Støtte for topic type-basert filtrering |
| `services/webhook_service.py` | Ruting basert på topic type |

### Konfigurasjonsfiler

| Fil | Endring |
|-----|---------|
| `.env` | Dokumentere nye variabler |
| `.env.example` | Oppdatere med alle nødvendige variabler |

---

## Referanser

- [README.md](../README.md) - Hovedarbeidsflyt
- [ARCHITECTURE_AND_DATAMODEL.md](./ARCHITECTURE_AND_DATAMODEL.md) - Event sourcing
- [backend/STRUCTURE.md](../backend/STRUCTURE.md) - Backend-arkitektur
- [topic-api-openapi.yaml](../topic-api-openapi.yaml) - Catenda Topic API
- [project-api-openapi.yaml](../project-api-openapi.yaml) - Catenda Project API
