# ADR-001: Dalux Sync Arkitekturbeslutninger

**Status:** Akseptert
**Dato:** 2026-01-13
**Beslutningstagere:** Utviklingsteam
**Kontekst:** Fase 1 implementasjon av Dalux → Catenda synkronisering

---

## Sammendrag

Dette dokumentet beskriver arkitekturbeslutningene tatt under implementasjon av Dalux Build → Catenda synkronisering. Hver beslutning inkluderer kontekst, alternativer vurdert, valgt løsning, og konsekvenser.

---

## ADR-001.1: Synkroniseringsretning

### Kontekst

Dalux Build og Catenda er to separate systemer som må holdes synkronisert. Entreprenører bruker Dalux for daglig arbeid, mens byggherren krever data i Catenda for kontraktsoppfølging.

### Alternativer vurdert

| Alternativ | Beskrivelse |
|------------|-------------|
| A: Enveis Dalux → Catenda | Dalux er master, Catenda er read-only speil |
| B: Enveis Catenda → Dalux | Catenda er master, Dalux oppdateres |
| C: Toveis synk | Endringer synkes begge veier |

### Beslutning

**Valgt: A - Enveis Dalux → Catenda**

### Begrunnelse

- Dalux API har **ingen skrivetilgang** på tasks (kun lesing)
- Entreprenør er kontraktuelt ansvarlig og bruker Dalux daglig
- Enveis-synk eliminerer kompleks konflikt-håndtering
- Catenda brukes for visning/godkjenning, ikke redigering

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Enkel implementasjon, tydelig dataflyt |
| Positiv | Ingen synk-loops eller konflikter |
| Negativ | Byggherres Catenda-endringer ignoreres |
| Negativ | Entreprenør må alltid gå til Dalux for endringer |

---

## ADR-001.2: Polling vs Webhooks

### Kontekst

Systemet må oppdage endringer i Dalux for å synkronisere til Catenda.

### Alternativer vurdert

| Alternativ | Latens | Kompleksitet | API-belastning |
|------------|--------|--------------|----------------|
| A: Polling | 15 min | Lav | Kontinuerlig |
| B: Webhooks | Instant | Middels | Ved endring |
| C: Long polling | Sekunder | Høy | Vedvarende |

### Beslutning

**Valgt: A - Polling med 15 minutters intervall**

### Begrunnelse

- Dalux tilbyr **ikke webhook-støtte** per januar 2026
- `/tasks/changes` endepunkt støtter inkrementell synk
- 15 minutter er akseptabelt for forretningsprosessen
- Polling er robust ved nettverksfeil

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Robust og forutsigbar |
| Positiv | Enkel å debugge og overvåke |
| Negativ | 15 min latens før endringer synkes |
| Negativ | Skalerer dårlig med mange prosjekter |
| Risiko | Må migrere hvis Dalux legger til webhooks |

### Fremtidig revisjon

Se `docs/dalux-catenda-integrasjonsplan.md` seksjon "Webhook-støtte" for migrasjonsstrategi.

---

## ADR-001.3: Manuell vs Automatisk Trigger

### Kontekst

Synkronisering kan trigges manuelt eller kjøres automatisk på intervall.

### Alternativer vurdert

| Alternativ | Beskrivelse | Infrastruktur |
|------------|-------------|---------------|
| A: Manuell CLI | Bruker kjører kommando | Ingen |
| B: Cron job | Linux crontab | Server |
| C: Azure Functions Timer | Serverless scheduler | Azure |
| D: Celery Beat | Python task queue | Redis + worker |

### Beslutning

**Valgt: A - Manuell CLI for Fase 1**

### Begrunnelse

- Fase 1 er MVP/prototype
- Unngår Azure Functions-avhengighet
- Enklere testing og debugging
- Full kontroll over når synk kjører

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Ingen infrastruktur-overhead |
| Positiv | Utviklervennlig for testing |
| Negativ | Krever manuell innsats |
| Negativ | Ingen automatisk oppdatering |
| Gjeld | Må implementere scheduler i Fase 2 |

### Migrasjonsvei

```
Fase 1: CLI (python scripts/dalux_sync.py sync)
Fase 2: Azure Functions Timer Trigger (15 min)
Fase 3: Vurder webhooks hvis Dalux støtter
```

---

## ADR-001.4: Database for Synk-metadata

### Kontekst

Synk-status og mapping mellom Dalux tasks og Catenda topics må persisteres.

### Alternativer vurdert

| Alternativ | Fordeler | Ulemper |
|------------|----------|---------|
| A: Supabase (PostgreSQL) | Konsistent, transaksjonsstøtte | Nettverksavhengig |
| B: SQLite | Enkel, lokal | Ikke delt mellom instanser |
| C: Redis | Rask | Ikke persistent som standard |
| D: JSON-filer | Ingen database | Skalerer ikke |

### Beslutning

**Valgt: A - Supabase (PostgreSQL)**

### Begrunnelse

- Konsistent med eksisterende arkitektur (events, metadata)
- Samme database som resten av systemet
- Transaksjonsstøtte for atomiske oppdateringer
- Row Level Security for tilgangskontroll

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Enhetlig database-lag |
| Positiv | Backup/recovery via Supabase |
| Negativ | Krever service_role key for backend |
| Negativ | Ingen lokal utvikling uten Supabase |

### Database-skjema

Se `backend/migrations/001_dalux_sync_tables.sql` for full skjemadefinisjon.

---

## ADR-001.5: API-nøkkel Lagring

### Kontekst

Dalux API krever per-prosjekt API-nøkler som må lagres sikkert.

### Alternativer vurdert

| Alternativ | Sikkerhet | Kompleksitet | Multi-tenant |
|------------|-----------|--------------|--------------|
| A: Plaintext i database | Lav | Ingen | Ja |
| B: Lokal .env fil | God | Ingen | Nei |
| C: Symmetrisk kryptering (AES) | Middels | Lav | Ja |
| D: Azure Key Vault | Høy | Middels | Ja |

### Beslutning

**Valgt: B - Lokal .env fil**

*Oppdatert 2026-01-13: Endret fra database-lagring til miljøvariabel.*

### Begrunnelse

- **Sikrere**: API-nøkkel aldri i database, ingen lekkasje-risiko
- **Enklere**: Ingen database-migrasjon for nøkkelendringer
- **Single-tenant**: Prosjektet er single-tenant, trenger ikke per-prosjekt nøkler
- **Standard praksis**: Følger 12-factor app prinsippet for secrets

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Sikker - nøkkel aldri i database |
| Positiv | Enkel rotasjon - bare endre .env |
| Positiv | Ingen database-migrasjon ved nøkkelbytte |
| Negativ | Kun én API-nøkkel per instans |
| Negativ | Må settes på hver server/miljø |

### Konfigurasjon

```bash
# .env
DALUX_API_KEY=din_api_nokkel_her
DALUX_BASE_URL=https://node1.field.dalux.com/service/api/
```

### Kode

```python
# lib/dalux_factory.py
def get_dalux_api_key() -> Optional[str]:
    return os.environ.get("DALUX_API_KEY")
```

### Fremtidig multi-tenant støtte

Hvis multi-tenant trengs senere:
1. Legg til `dalux_api_key_encrypted` kolonne i database
2. Bruk Azure Key Vault for krypteringsnøkkel
3. Fallback til env var hvis ikke satt i database

---

## ADR-001.6: Event Sourcing for Synk-operasjoner

### Kontekst

Systemet bruker Event Sourcing for KOE-saker. Skal synk-operasjoner også bruke events?

### Alternativer vurdert

| Alternativ | Beskrivelse |
|------------|-------------|
| A: Event Sourcing | `DaluxTaskSyncedEvent`, `DaluxSyncFailedEvent` etc. |
| B: Direkte CRUD | Vanlige database-operasjoner |

### Beslutning

**Valgt: B - Direkte CRUD uten Event Sourcing**

### Begrunnelse

- Event Sourcing brukes for **forretningsdomenet** (KOE-saker)
- Dalux-synk er **infrastruktur/integrasjon**, ikke forretningslogikk
- Synk-status trenger ikke immutabilitet eller "spole tilbake"
- Unngår støy i event log

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Enklere implementasjon |
| Positiv | Raskere queries (ingen projeksjoner) |
| Positiv | Mindre støy i event log |
| Negativ | Inkonsistent med KOE-domenet |
| Negativ | Ingen audit trail via event log |

### Alternativ audit

Synk-operasjoner logges via `utils.logger` med:
- Timestamp
- Mapping ID
- Tasks prosessert/feilet
- Feilmeldinger

---

## ADR-001.7: Klient-struktur

### Kontekst

DaluxClient må kommunisere med Dalux Build API.

### Alternativer vurdert

| Alternativ | Beskrivelse |
|------------|-------------|
| A: Speile CatendaClient | Samme struktur og patterns |
| B: Minimal klient | Kun nødvendige metoder |
| C: Generert fra OpenAPI | Auto-generert SDK |

### Beslutning

**Valgt: A - Speile CatendaClient**

### Begrunnelse

- Utviklere kjenner allerede CatendaClient
- Samme rate limiting, error handling, logging
- Enklere code review
- Konsistent kodebase

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Konsistent og gjenkjennelig |
| Positiv | Enklere onboarding |
| Negativ | Kan være suboptimalt for Dalux HATEOAS API |
| Negativ | Kopierer eventuelle feil fra CatendaClient |

### Kode-lokasjon

```
backend/integrations/dalux/
├── __init__.py          # Eksporter
└── client.py            # DaluxClient (speiler catenda/client.py)
```

---

## Oppsummering

| # | Beslutning | Valg | Risiko |
|---|------------|------|--------|
| 1 | Synk-retning | Enveis Dalux → Catenda | Lav |
| 2 | Synk-mekanisme | Polling (15 min) | Middels |
| 3 | Trigger | Manuell CLI | Middels |
| 4 | Database | Supabase | Lav |
| 5 | API-nøkler | Miljøvariabel (.env) | Lav |
| 6 | Event Sourcing | Nei (direkte CRUD) | Lav |
| 7 | Klient-struktur | Speiler CatendaClient | Lav |

---

## Relaterte dokumenter

- [dalux-catenda-integrasjonsplan.md](dalux-catenda-integrasjonsplan.md) - Overordnet integrasjonsplan
- [ARCHITECTURE_AND_DATAMODEL.md](ARCHITECTURE_AND_DATAMODEL.md) - System-arkitektur
- [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) - Sikkerhetsarkitektur
- `backend/migrations/001_dalux_sync_tables.sql` - Database-skjema

---

## Endringslogg

| Dato | Versjon | Endring |
|------|---------|---------|
| 2026-01-13 | 1.0 | Initial versjon - Fase 1 implementasjon |
| 2026-01-13 | 1.1 | ADR-001.5: Endret API-nøkkel fra database til .env |
