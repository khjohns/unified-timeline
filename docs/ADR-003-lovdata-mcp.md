# ADR-003: Lovdata MCP Arkitektur

**Status:** Akseptert
**Dato:** 2026-02-03
**Oppdatert:** 2026-02-05 (lengre snippets, innholdsfortegnelse)
**Beslutningstagere:** Utviklingsteam
**Kontekst:** Implementasjon av MCP-integrasjon for norsk lovdata

---

## Sammendrag

Dette dokumentet beskriver arkitekturbeslutningene for Lovdata MCP-integrasjonen. Formålet er å gi Claude/LLM effektiv tilgang til presis norsk lovtekst gjennom Model Context Protocol (MCP).

---

## ADR-003.1: API-tilgang

### Kontekst

Lovdata tilbyr to tilgangsnivåer:
- **Gratis Public Data API:** Bulk-nedlasting av tar.bz2-arkiver med alle lover/forskrifter
- **Betalt REST API:** Sanntids oppslag og søk med X-API-Key

Claude trenger tilgang til lovtekst for å gi presise svar om norsk rett.

### Alternativer vurdert

| Alternativ | Kostnad | Latens | Kompleksitet |
|------------|---------|--------|--------------|
| A: Betalt REST API | Ukjent (kontakt Lovdata) | Lav | Lav |
| B: Gratis bulk + lokal cache | Gratis | Lav etter sync | Høy |
| C: Kun lenker (ingen tekst) | Gratis | N/A | Minimal |
| D: Python-pakke "lovlig" | Gratis | Lav etter sync | Medium |

### Beslutning

**Valgt: B - Gratis bulk-nedlasting med lokal cache**

### Begrunnelse

- **Kostnad:** Gratis under NLOD 2.0-lisens
- **Kontroll:** Full kontroll over parsing og søk
- **Uavhengighet:** Ingen avhengighet til tredjeparts-pakker
- **Ytelse:** Etter initial sync er oppslag svært raske (<100ms)
- "lovlig"-pakken (alt. D) mangler dokumentasjon og vedlikeholdes ikke aktivt

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Ingen løpende kostnader |
| Positiv | Full kontroll over datamodell og søk |
| Negativ | Vedlikeholdsbyrde for sync og parsing |
| Negativ | Initial sync tar 5-10 minutter |
| Negativ | Data kan være opptil 24 timer gammel |

---

## ADR-003.2: Lagringsbackend

### Kontekst

Lovdata-arkivene inneholder ~4500 XML-filer (770 lover + 3666 forskrifter). Disse må lagres og indekseres for effektivt søk.

Backend deployes på Render med ephemeral filesystem.

### Alternativer vurdert

| Alternativ | Persistens | FTS-støtte | Kompleksitet | Egnet for cloud |
|------------|------------|------------|--------------|-----------------|
| A: SQLite lokal fil | Nei (ephemeral) | FTS5 | Lav | Nei |
| B: Supabase PostgreSQL | Ja | tsvector/GIN | Medium | Ja |
| C: Elasticsearch | Ja | Excellent | Høy | Ja (kostnad) |
| D: Fil-basert cache | Nei | Nei | Lav | Nei |

### Beslutning

**Valgt: B - Supabase PostgreSQL med automatisk fallback til SQLite for lokal utvikling**

### Begrunnelse

- **Persistens:** Data overlever redeploys på Render
- **FTS:** PostgreSQL tsvector med norsk stemming gir god søkekvalitet
- **Allerede i bruk:** Prosjektet bruker Supabase for andre formål
- **Kostnad:** Inkludert i eksisterende Supabase-plan
- SQLite brukes som fallback for lokal utvikling uten Supabase

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Data persistent på tvers av deploys |
| Positiv | Norsk fulltekstsøk med stemming |
| Positiv | Ingen ekstra infrastruktur |
| Negativ | Avhengighet til Supabase |
| Negativ | Nettverkslatens vs lokal SQLite |

---

## ADR-003.3: Sync-strategi

### Kontekst

Lovdata-arkivene er ~50MB (lover) + ~150MB (forskrifter) komprimert. Ved dekomprimering og parsing kan minnebruken bli høy.

Render free tier har 512MB RAM.

### Alternativer vurdert

| Alternativ | Minnebruk | Kompleksitet | Robusthet |
|------------|-----------|--------------|-----------|
| A: Last alt i minne | Høy (>1GB) | Lav | Lav |
| B: Streaming med temp-fil | Lav (~100MB) | Medium | Høy |
| C: Chunked download | Medium | Høy | Medium |

### Beslutning

**Valgt: B - Streaming til temp-fil med batched processing**

### Begrunnelse

- **Minnebruk:** Streamer nedlasting til temp-fil, prosesserer 50 dokumenter om gangen
- **Robusthet:** Upsert-logikk gjør sync idempotent og gjenopptakbar
- **Kompatibilitet:** Fungerer på Render free tier (512MB)

### Implementasjonsdetaljer

```python
# Pseudo-kode for streaming sync
with tempfile.NamedTemporaryFile() as tmp:
    # Stream download
    with httpx.stream(url) as response:
        for chunk in response.iter_bytes():
            tmp.write(chunk)

    # Process in batches
    with tarfile.open(tmp, mode='r:bz2') as tar:
        for batch in chunks(tar, size=50):
            documents = parse_xml_batch(batch)
            upsert_to_supabase(documents)
```

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Fungerer på begrenset minne |
| Positiv | Gjenopptakbar ved avbrudd |
| Negativ | Litt tregere enn alt-i-minne |
| Negativ | Krever temp-fil tilgang |

---

## ADR-003.4: Søkemotor

### Kontekst

Claude trenger å finne relevante paragrafer basert på søkeord eller tema. Søk må være raskt nok for interaktiv bruk (<3 sekunder).

Datasettet inneholder:
- **4 436 dokumenter** (lover og forskrifter)
- **92 027 seksjoner** (paragrafer)
- **160 MB** tabell + **42 MB** TOAST + **37 MB** GIN-indeks

### Alternativer vurdert

| Alternativ | Latens | Relevans | Kompleksitet |
|------------|--------|----------|--------------|
| A: PostgreSQL FTS med ts_headline | 8+ sek | Høy | Lav |
| B: PostgreSQL FTS uten ts_headline | <100ms | Høy | Lav |
| C: Elasticsearch | <50ms | Meget høy | Høy |
| D: Simple LIKE-søk | Variabel | Lav | Minimal |

### Beslutning

**Valgt: B - PostgreSQL FTS uten ts_headline, med CTE-optimalisering**

### Begrunnelse

- **Ytelse:** `ts_headline()` er svært treg på store tekster (~1000ms). Ved å bruke enkel truncation og CTE-optimalisering går søk ned til ~6ms.
- **Tilstrekkelig:** For MCP-bruk er det viktigste å finne riktig paragraf (dok_id + section_id). Full tekst hentes i separat kall.
- **Enkel:** Ingen ekstra infrastruktur utover eksisterende Supabase.

### SQL-funksjon (optimalisert)

```sql
CREATE OR REPLACE FUNCTION search_lovdata_fast(
    query_text TEXT,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    dok_id TEXT,
    section_id TEXT,
    title TEXT,
    short_title TEXT,
    doc_type TEXT,
    snippet TEXT,
    rank REAL
)
LANGUAGE sql
STABLE
AS $$
    -- CTE: Finn først bare IDs og rank (uten å lese content)
    WITH ranked AS (
        SELECT
            s.dok_id,
            s.section_id,
            ts_rank(s.search_vector, plainto_tsquery('norwegian', query_text)) as rank
        FROM lovdata_sections s
        WHERE s.search_vector @@ plainto_tsquery('norwegian', query_text)
        ORDER BY rank DESC
        LIMIT max_results
    )
    -- Deretter: hent content og document-info kun for topp-treff
    SELECT
        r.dok_id,
        r.section_id,
        d.title,
        d.short_title,
        d.doc_type,
        LEFT(s.content, 500) as snippet,  -- 500 chars gir bedre kontekst
        r.rank
    FROM ranked r
    JOIN lovdata_documents d ON d.dok_id = r.dok_id
    JOIN lovdata_sections s ON s.dok_id = r.dok_id AND s.section_id = r.section_id;
$$;
```

### Ytelsesoptimalisering

**Problem:** Naiv JOIN + ORDER BY tvinger PostgreSQL til å lese alle matchende rader (inkludert store `content`-kolonner) før sortering.

**Løsning:** CTE-pattern som:
1. Først finner kun `dok_id`, `section_id` og `rank` via GIN-indeks
2. Sorterer og limiterer på dette lille datasettet
3. Deretter JOINer for å hente `content` og metadata kun for topp-N treff

### Målte ytelsestall

| Scenario | Latens | Merknad |
|----------|--------|---------|
| Cold cache (første kjøring) | ~600ms | Data leses fra disk |
| Warm cache (påfølgende) | **5-6ms** | Data i PostgreSQL buffer cache |
| Med ts_headline (til sammenligning) | ~1000ms | Uakseptabelt |

**Testet med:** `EXPLAIN ANALYZE SELECT * FROM search_lovdata_fast('erstatning', 5);`

### Cold vs Warm Cache

PostgreSQL bruker en buffer cache for nylig aksesserte data. I produksjon vil hyppig brukte sider være i minne, så typisk responstid er **5-10ms**.

Ved første kjøring etter deploy/restart kan responstiden være høyere (~600ms) mens data leses fra disk. Dette er normal oppførsel og ikke et problem i praksis.

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Rask responstid (~6ms warm cache) |
| Positiv | Norsk stemming (finner "straff" i "straffes") |
| Positiv | CTE-pattern unngår å lese store kolonner unødvendig |
| Positiv | 500-tegn snippets gir god kontekst for relevansvurdering |
| Negativ | Ingen highlighting i snippet |
| Negativ | Snippet er alltid starten av teksten, ikke kontekst rundt treffet |

---

## ADR-003.5: MCP-verktøy

### Kontekst

Claude trenger verktøy for å:
1. Søke etter relevante paragrafer
2. Hente full tekst for spesifikke paragrafer
3. Sjekke størrelse før henting (token-bevissthet)

### Status

**Backend-tjenester:** ✅ Implementert i `backend/services/lovdata_service.py`
**MCP-server:** ✅ Implementert i `backend/mcp/server.py`
**MCP-routes:** ✅ Eksponert via `backend/routes/mcp_routes.py`

### MCP-verktøy

| Verktøy | Backend-metode | MCP |
|---------|----------------|-----|
| `lov(lov_id, paragraf, max_tokens)` | `LovdataService.lookup_law()` | ✅ |
| `forskrift(forskrift_id, paragraf, max_tokens)` | `LovdataService.lookup_regulation()` | ✅ |
| `sok(query, limit=20)` | `LovdataService.search()` | ✅ |
| `liste()` | `LovdataService.list_available_laws()` | ✅ |
| `status()` | `LovdataService.get_sync_status()` | ✅ |
| `sync(force)` | `LovdataService.sync()` | ✅ |
| `sjekk_storrelse(lov_id, paragraf)` | `LovdataService.get_section_size()` | ✅ |
| `hent_flere(lov_id, paragrafer)` | `LovdataService.lookup_sections_batch()` | ✅ |

### Batch-henting

Hent flere paragrafer i ett kall - ~80% raskere enn separate kall:

```
# Separate kall: 491ms
lov('personopplysningsloven', 'Artikkel 5')
lov('personopplysningsloven', 'Artikkel 6')
lov('personopplysningsloven', 'Artikkel 35')

# Batch: 100ms
hent_flere('personopplysningsloven', ['Artikkel 5', 'Artikkel 6', 'Artikkel 35'])
```

### Innholdsfortegnelse

Når `lov()` eller `forskrift()` kalles **uten paragraf-parameter**, returneres en innholdsfortegnelse:

```
### Innholdsfortegnelse: Personopplysningsloven

**Totalt:** 134 paragrafer (~45,000 tokens)

| Paragraf | Tittel | Tokens |
|----------|--------|-------:|
| § 1 | Gjennomføring av personvernforordningen | 124 |
| § 2 | Saklig virkeområde | 321 |
| § Artikkel 5 | Prinsipper for behandling | 467 |
...
```

Dette lar Claude:
- Vurdere omfang før henting
- Navigere til relevante paragrafer
- Estimere token-kostnad

### MCP-instruksjoner

Serveren inkluderer instruksjoner som sendes til klienter ved tilkobling:

- **`instructions`** i initialize-respons - automatisk til alle klienter
- **`prompts/get("lovdata-guide")`** - for eksplisitt henting

Instruksjonene dekker:
- Tilgjengelige verktøy og aliaser
- Begrensninger (ingen rettsavgjørelser/forarbeider)
- Brukstips og formatering

### Arbeidsflyt for Claude

```
1. sok("standstill karensperiode", limit=10)
   → Får liste med relevante paragrafer

2. Vurder hvilke som er relevante basert på snippet

3. lov("forskrift/2016-08-12-974", "25-2")
   → Hent full tekst for relevant paragraf

4. Presenter svar til bruker med presis lovhenvisning
```

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Claude kan selvstendig finne og hente lovtekst |
| Positiv | Token-effektivt (henter kun det som trengs) |
| Positiv | Presise lovhenvisninger i svar |
| Positiv | Instruksjoner bakt inn i MCP - fungerer fra alle klienter |

---

## Vedlegg: Datamodell

### Tabeller

```sql
-- Dokumenter (lover og forskrifter)
lovdata_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dok_id TEXT UNIQUE NOT NULL,  -- f.eks. "lov/2005-05-20-28"
    ref_id TEXT,
    title TEXT,
    short_title TEXT,
    date_in_force DATE,
    ministry TEXT,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('lov', 'forskrift')),
    search_vector TSVECTOR,
    indexed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Seksjoner (paragrafer)
lovdata_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dok_id TEXT NOT NULL REFERENCES lovdata_documents(dok_id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,  -- f.eks. "3-9"
    title TEXT,
    content TEXT NOT NULL,
    address TEXT,  -- data-absoluteaddress fra XML
    char_count INTEGER GENERATED ALWAYS AS (LENGTH(content)) STORED,
    search_vector TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dok_id, section_id)
)

-- Sync-metadata
lovdata_sync_meta (
    dataset TEXT PRIMARY KEY,  -- 'lover' | 'forskrifter'
    last_modified TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    file_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'syncing', 'error'))
)
```

### Indekser

```sql
-- GIN-indekser for fulltekstsøk (kritisk for ytelse)
CREATE INDEX idx_lovdata_sections_search ON lovdata_sections USING GIN (search_vector);
CREATE INDEX idx_lovdata_documents_search ON lovdata_documents USING GIN (search_vector);

-- B-tree indekser for oppslag
CREATE INDEX idx_lovdata_documents_dok_id ON lovdata_documents(dok_id);
CREATE INDEX idx_lovdata_documents_short_title ON lovdata_documents(short_title);
CREATE INDEX idx_lovdata_sections_dok_section ON lovdata_sections(dok_id, section_id);
```

### Kolonnestørrelser (målt)

| Kolonne | Gjennomsnitt | Merknad |
|---------|--------------|---------|
| content | 498 bytes | Lovtekst |
| search_vector | 419 bytes | tsvector for FTS |
| title | 33 bytes | Paragraftittel |
| dok_id | 23 bytes | Dokument-ID |

---

## Vedlegg: Begrensninger i Lovdata API

### Hva er inkludert (gratis)

| Kilde | Status | Tilgang |
|-------|--------|---------|
| Gjeldende lover (NL) | ✅ | Bulk-nedlasting |
| Sentrale forskrifter (SF) | ✅ | Bulk-nedlasting |
| Lokale forskrifter (LF) | ✅ | Bulk-nedlasting |
| Delegeringer (DEL) | ✅ | Bulk-nedlasting |
| Instrukser (INS) | ✅ | Bulk-nedlasting |
| Stortingsvedtak (STV) | ✅ | Bulk-nedlasting |

### Hva er IKKE inkludert

| Kilde | Status | Merknad |
|-------|--------|---------|
| Rettsavgjørelser (HR, LG, LA) | ❌ | Kun Lovdata Pro (web) |
| Forarbeider (NOU, Prop., Ot.prp.) | ❌ | Kun Lovdata Pro (web) |
| Juridiske artikler | ❌ | Kun Lovdata Pro (web) |

Fra API-dokumentasjonen:
> "Note that content from several sources are unavailable through this API."

**Konklusjon:** Betalt Lovdata API gir kun raskere tilgang til lover/forskrifter - ikke rettsavgjørelser eller forarbeider. For disse kreves Lovdata Pro webgrensesnitt.

---

## Referanser

- [Lovdata Public API](https://api.lovdata.no/)
- [Lovdata XML-format dokumentasjon](https://lovdata.no/dokument/FORMAT/forside)
- [PostgreSQL Full Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Lovdata API OpenAPI spec](../tredjepart-api/lovdata-api.json)
