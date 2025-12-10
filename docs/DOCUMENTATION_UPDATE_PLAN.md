# Documentation Update Plan

**Opprettet:** 2025-12-08
**Status:** Under arbeid

## Oversikt

Denne planen beskriver oppdateringer som trengs for å holde dokumentasjonen synkronisert med kodebasen.

---

## Dokumenter som skal oppdateres

### 1. GETTING_STARTED.md

**Status:** [ ] Ikke startet

**Feil/utdatert informasjon:**

| Linje | Problem | Løsning |
|-------|---------|---------|
| 260-261 | Refererer til `test_routes/test_varsel_routes.py` som er slettet | Fjern referansen, oppdater til gyldige testeksempler |
| 436 | Viser 345 tester (ble nylig oppdatert, verifiser) | Bekreft gjeldende antall |
| 462 | Refererer til `routes/event_routes.py` | OK - denne eksisterer |
| 483-486 | Lenker til filer som kanskje ikke eksisterer (API.md, HLD) | Verifiser at lenker fungerer |

**Endringer:**
- [ ] Fjern referanse til `test_varsel_routes.py` (linje 260)
- [ ] Oppdater testtall hvis nødvendig
- [ ] Verifiser alle dokumentlenker

---

### 2. FRONTEND_ARCHITECTURE.md

**Status:** [ ] Ikke startet

**Feil/utdatert informasjon:**

| Linje | Problem | Løsning |
|-------|---------|---------|
| 740-744 | Test-status fra 2025-12-01, viser 95 tester | Verifiser nåværende tall |
| 153-177 | EventType enum bruker STORE_BOKSTAVER men backend bruker små | Synkroniser med backend (`models/events.py`) |
| 105-108 | `services/api.ts` og `revisionService.ts` | Verifiser at filene eksisterer |
| 73-76 | Panel-linjetall (14446, 21306, etc.) ser feil ut | Verifiser faktiske linjetall |

**Endringer:**
- [ ] Oppdater EventType enum til å matche backend (lowercase)
- [ ] Verifiser panel-linjetall
- [ ] Oppdater test-statistikk
- [ ] Verifiser at alle filreferanser er gyldige

---

### 3. DEPLOYMENT.md

**Status:** [ ] Ikke startet

**Feil/utdatert informasjon:**

| Linje | Problem | Løsning |
|-------|---------|---------|
| 139-161 | `function_app.py` beskrives som "må opprettes" men eksisterer | Oppdater til å reflektere at den eksisterer |
| 198-240 | Eksempel `function_app.py` bruker legacy routes | Oppdater til event sourcing routes |
| 289-314 | DataverseEventRepository eksempel | Verifiser at interface matcher faktisk kode |
| 575-582 | Smoke test refererer til feil endepunkter | Oppdater til `/api/events`, `/api/cases/{id}/state` |

**Endringer:**
- [ ] Oppdater function_app.py status til "eksisterer"
- [ ] Oppdater function_app.py eksempel til å bruke event sourcing routes
- [ ] Verifiser Dataverse repository interface
- [ ] Oppdater smoke test endepunkter

---

### 4. README.md (rot)

**Status:** [ ] Ikke startet

**Feil/utdatert informasjon:**

| Linje | Problem | Løsning |
|-------|---------|---------|
| 436-459 | Test-statistikk fra 2025-12-06 | Oppdater til nåværende tall (345 pytest, 31 E2E) |
| 361-362 | `models/events.py` 933 linjer, `sak_state.py` 562 linjer | Verifiser linjetall |
| 255-258 | Python 3.8+ nevnt, men bør være 3.10+ | Oppdater til 3.10+ (Pydantic v2) |

**Endringer:**
- [ ] Oppdater Python-versjon til 3.10+
- [ ] Oppdater test-statistikk
- [ ] Verifiser linjetall i filreferanser

---

### 5. QUICKSTART.md

**Status:** [ ] Ikke startet

**Feil/utdatert informasjon:**

| Linje | Problem | Løsning |
|-------|---------|---------|
| Generelt | Refererer til mock mode og `data/events_*.json` | Verifiser faktiske stier |
| 194-233 | Data storage beskrivelse | Verifiser at stiene er korrekte (`koe_data/events/`) |
| 46-47 | Port 5173 vs 3000 | ✅ Fikset 2025-12-08: Port er 3000 |

**Endringer:**
- [ ] Verifiser data-stier
- [x] Verifiser port-konfigurasjon (port 3000)
- [ ] Oppdater eventuelt utdaterte eksempler

---

### 6. backend/STRUCTURE.md

**Status:** [ ] Ikke startet

**Feil/utdatert informasjon:**

| Linje | Problem | Løsning |
|-------|---------|---------|
| 104-140 | Test-struktur refererer til filer som er slettet | Oppdater til faktisk teststruktur |
| 533-544 | Test coverage tabell | Oppdater til nåværende tall |
| 686 | Totalt 59 filer, ~13,700 linjer | Verifiser |

**Endringer:**
- [ ] Oppdater test-filstruktur (fjern slettede filer)
- [ ] Oppdater test coverage tabell
- [ ] Verifiser linjetall

---

## Prioritering

1. **Høy prioritet** (brukes daglig):
   - GETTING_STARTED.md
   - README.md

2. **Medium prioritet** (brukes ved spesifikke oppgaver):
   - FRONTEND_ARCHITECTURE.md
   - DEPLOYMENT.md

3. **Lav prioritet** (referansedokumenter):
   - QUICKSTART.md
   - backend/STRUCTURE.md

---

## Fremdrift

| Dokument | Status | Dato |
|----------|--------|------|
| GETTING_STARTED.md | [x] Ferdig | 2025-12-08 |
| FRONTEND_ARCHITECTURE.md | [x] Ferdig | 2025-12-08 |
| DEPLOYMENT.md | [x] Ferdig | 2025-12-08 |
| README.md | [x] Ferdig | 2025-12-08 |
| QUICKSTART.md | [x] Ferdig | 2025-12-08 |
| backend/STRUCTURE.md | [x] Ferdig | 2025-12-08 |

---

## Notater

- **NS_8407.md** skal IKKE endres (informasjonskilde for kontraktsregler)
- Andre dokumenter i /docs ignoreres per brukerinstruksjon
- Fokus på å fjerne referanser til slettede filer og oppdatere statistikk
