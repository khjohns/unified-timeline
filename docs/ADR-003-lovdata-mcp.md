# ADR-003: Lovdata MCP Arkitektur

**Status:** Akseptert
**Dato:** 2026-02-03
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

### Alternativer vurdert

| Alternativ | Latens | Relevans | Kompleksitet |
|------------|--------|----------|--------------|
| A: PostgreSQL FTS med ts_headline | 8+ sek | Høy | Lav |
| B: PostgreSQL FTS uten ts_headline | <100ms | Høy | Lav |
| C: Elasticsearch | <50ms | Meget høy | Høy |
| D: Simple LIKE-søk | Variabel | Lav | Minimal |

### Beslutning

**Valgt: B - PostgreSQL FTS uten ts_headline**

### Begrunnelse

- **Ytelse:** `ts_headline()` er svært treg på store tekster. Ved å bruke enkel truncation i stedet for highlighting går søk fra 8+ sekunder til <100ms.
- **Tilstrekkelig:** For MCP-bruk er det viktigste å finne riktig paragraf (dok_id + section_id). Full tekst hentes i separat kall.
- **Enkel:** Ingen ekstra infrastruktur utover eksisterende Supabase.

### SQL-funksjon

```sql
CREATE FUNCTION search_lovdata_fast(query_text TEXT, max_results INTEGER)
RETURNS TABLE (dok_id, section_id, title, short_title, doc_type, snippet, rank)
AS $$
    SELECT d.dok_id, s.section_id, d.title, d.short_title, d.doc_type,
           LEFT(s.content, 200) as snippet,  -- Enkel truncate
           ts_rank(s.search_vector, tsquery) as rank
    FROM lovdata_sections s
    JOIN lovdata_documents d ON d.dok_id = s.dok_id
    WHERE s.search_vector @@ plainto_tsquery('norwegian', query_text)
    ORDER BY rank DESC
    LIMIT max_results;
$$ LANGUAGE sql;
```

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Rask responstid (<100ms) |
| Positiv | Norsk stemming (finner "straff" i "straffes") |
| Negativ | Ingen highlighting i snippet |
| Negativ | Snippet er alltid starten av teksten, ikke kontekst rundt treffet |

---

## ADR-003.5: MCP-verktøy

### Kontekst

Claude trenger verktøy for å:
1. Søke etter relevante paragrafer
2. Hente full tekst for spesifikke paragrafer
3. Sjekke størrelse før henting (token-bevissthet)

### Beslutning

**MCP-verktøy eksponert:**

| Verktøy | Formål |
|---------|--------|
| `sok(query, limit)` | Fulltekstsøk, returnerer dok_id + section_id |
| `lov(lov_id, paragraf)` | Hent full paragraftekst |
| `forskrift(forskrift_id, paragraf)` | Alias for lov() med forskrifter |
| `liste()` | Vis tilgjengelige lover/aliaser |
| `status()` | Sync-status |
| `sync(force)` | Trigger manuell sync |
| `sjekk_storrelse(lov_id, paragraf)` | Estimer tokens før henting |

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

---

## Vedlegg: Datamodell

### Tabeller

```sql
-- Dokumenter (lover og forskrifter)
lovdata_documents (
    dok_id TEXT PRIMARY KEY,  -- f.eks. "lov/2005-05-20-28"
    title TEXT,
    short_title TEXT,
    date_in_force DATE,
    doc_type TEXT,  -- 'lov' | 'forskrift'
    search_vector TSVECTOR
)

-- Seksjoner (paragrafer)
lovdata_sections (
    dok_id TEXT REFERENCES lovdata_documents,
    section_id TEXT,  -- f.eks. "3-9"
    title TEXT,
    content TEXT,
    search_vector TSVECTOR,
    PRIMARY KEY (dok_id, section_id)
)

-- Sync-metadata
lovdata_sync_meta (
    dataset TEXT PRIMARY KEY,  -- 'lover' | 'forskrifter'
    last_modified TIMESTAMPTZ,
    file_count INTEGER,
    status TEXT
)
```

### Indekser

```sql
CREATE INDEX idx_sections_search ON lovdata_sections USING GIN (search_vector);
CREATE INDEX idx_documents_search ON lovdata_documents USING GIN (search_vector);
```

---

## Referanser

- [Lovdata Public API](https://api.lovdata.no/)
- [Lovdata XML-format dokumentasjon](https://lovdata.no/dokument/FORMAT/forside)
- [PostgreSQL Full Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Model Context Protocol](https://modelcontextprotocol.io/)
