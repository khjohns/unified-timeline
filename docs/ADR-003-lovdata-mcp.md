# ADR-003: Lovdata MCP Arkitektur

**Status:** Akseptert
**Dato:** 2026-02-03
**Oppdatert:** 2026-02-06 (hierarkisk struktur, vektorsøk, OR-fallback, alias-oppløsning, input-validering, edge case testing, fuzzy minimum lengde, semantisk_sok, robusthet)
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
- **4 439 dokumenter** (lover og forskrifter)
- **92 130 seksjoner** (paragrafer), hvorav 90 253 har embeddings
- **13 909 strukturer** (deler, kapitler, avsnitt, vedlegg)
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

### SQL-funksjon (forenklet oversikt)

Funksjonen `search_lovdata_fast` bruker CTE-pattern for ytelse og inkluderer OR-fallback:

```sql
CREATE OR REPLACE FUNCTION search_lovdata_fast(
    query_text TEXT,
    max_results INTEGER DEFAULT 20
) RETURNS TABLE (
    dok_id TEXT, section_id TEXT, title TEXT, short_title TEXT,
    doc_type TEXT, snippet TEXT, rank REAL, search_mode TEXT
) LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
    has_special_operators BOOLEAN;
    and_count INT;
BEGIN
    -- Sjekk for spesialoperatorer (OR, "frase", -ekskludering)
    has_special_operators := (query_text ~* '\mOR\M' OR query_text ~ '"' OR query_text ~ '-\w');

    -- 1. Prøv AND-søk først
    RETURN QUERY WITH ranked AS (
        SELECT s.dok_id, s.section_id,
            ts_rank(s.search_vector, websearch_to_tsquery('norwegian', query_text)) as rk
        FROM lovdata_sections s
        WHERE s.search_vector @@ websearch_to_tsquery('norwegian', query_text)
        ORDER BY rk DESC LIMIT max_results
    )
    SELECT r.dok_id, r.section_id, d.title, d.short_title, d.doc_type,
           LEFT(s.content, 500), r.rk, 'and'::TEXT
    FROM ranked r
    JOIN lovdata_documents d ON d.dok_id = r.dok_id
    JOIN lovdata_sections s ON s.dok_id = r.dok_id AND s.section_id = r.section_id;

    GET DIAGNOSTICS and_count = ROW_COUNT;

    -- 2. Hvis 0 treff OG ingen spesialoperatorer → OR-fallback
    IF and_count = 0 AND NOT has_special_operators THEN
        RETURN QUERY ... -- Samme query med ' OR ' mellom ord, search_mode='or_fallback'
    END IF;
END;
$$;
```

Se `supabase/migrations/20260206_fts_or_fallback.sql` for full implementasjon.

### Websearch-syntaks (2026-02-05)

**Problem:** `plainto_tsquery` bruker implisitt AND - alle ord må matche. Dette feilet for søk som `anskaffelsesforskriften miljø` fordi "anskaffelsesforskriften" er dokumenttittel, ikke innhold.

**Løsning:** Byttet til `websearch_to_tsquery` som gir LLM kontroll over søkelogikken:

| Syntaks | Eksempel | Betydning |
|---------|----------|-----------|
| Standard | `mangel bolig` | Begge ord må matche (AND) |
| OR | `miljø OR klima` | Minst ett ord må matche |
| Frase | `"vesentlig mislighold"` | Eksakt frase |
| Ekskludering | `mangel -bil` | "mangel" men ikke "bil" |

**Testet og bekreftet:**
- `miljø OR tildelingskriterier` → Fant anskaffelsesforskriften § 8-11 ✅
- `"vesentlig mislighold"` → Kun eksakte treff ✅
- `mangel -bil` → Ekskluderte bilrelaterte treff ✅

### Automatisk OR-fallback (2026-02-06)

**Problem:** Websearch bruker AND-logikk som default - alle ord må finnes i samme paragraf. Søk som `oppsigelse nedbemanning` returnerte 0 treff fordi få paragrafer inneholder begge ordene.

**Løsning:** SQL-funksjonen prøver først AND-søk, og faller automatisk tilbake til OR hvis:
1. AND-søk returnerer 0 resultater
2. Query har ingen spesialoperatorer (OR, "frase", -ekskludering)

```sql
-- Pseudo-logikk
IF and_count = 0 AND NOT has_special_operators THEN
    or_query := regexp_replace(query_text, '\s+', ' OR ', 'g');
    -- Kjør OR-søk
END IF;
```

**Indikatorer:**
- `search_mode: 'and'` - Normal søk, resultater funnet med AND
- `search_mode: 'or_fallback'` - AND ga 0 treff, brukte OR-fallback

**Brukermelding:** Når OR-fallback brukes, vises:
> **Merk:** Søk med alle ordene ga 0 treff. Viser resultater der minst ett av ordene finnes.
> For mer presist søk, bruk `"eksakt frase"` eller `ord1 OR ord2` syntaks.

**Viktig:** Spesialoperatorer konverteres IKKE til OR:
- `"vesentlig mislighold"` → Forblir fraselasting
- `miljø OR klima` → Beholder eksplisitt OR
- `mangel -bil` → Beholder ekskludering

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

## ADR-003.4b: Vektorsøk (hybrid)

### Kontekst

FTS krever at brukeren kjenner juridisk terminologi. Vektorsøk muliggjør naturlig språk:

```
FTS:    "mangel bolig" → ✅ treff
FTS:    "skjulte feil i boligen" → ❌ ingen treff

Vektor: "skjulte feil i boligen" → ✅ finner "mangel"-paragrafer
```

### Beslutning

**Valgt: Hybrid søk (50% vektor + 50% FTS) med pgvector**

### Implementasjon

| Komponent | Teknologi |
|-----------|-----------|
| Embedding-modell | Gemini gemini-embedding-001 (1536 dim) |
| Vektor-indeks | pgvector **IVFFlat** (lists=100) |
| Hybrid-scoring | `(1-fts_weight) * similarity + fts_weight * fts_rank` |

**Merk:** IVFFlat valgt over HNSW fordi HNSW-indeksbygging timet ut på 90k vektorer. IVFFlat er raskere å bygge og gir god nok recall med `probes=10`.

### Testresultater (2026-02-06)

| Test | FTS | Vektor | Hybrid |
|------|-----|--------|--------|
| Eksakt frase ("vesentlig mislighold") | ✅ Beste | ⚠️ Relaterte i samme lov | ✅ |
| Synonym (avskjed ↔ oppsigelse) | ❌ Separate søk | ✅ Kobler (0.86+) | ✅ |
| Naturlig språk | ❌ Ofte 0 treff | ✅ Beste | ✅ |
| Filter (doc_type, ministry) | ✅ | ✅ | ✅ |

**Eksempel hybrid-resultat:** "forbruker OR heving"

| Paragraf | Similarity | FTS Rank | Combined |
|----------|------------|----------|----------|
| Forbrukerkjøpsloven §23 Heving | 1.000 | 0.334 | **0.667** |
| Forbrukerkjøpsloven §49 Virkninger av heving | 0.908 | 0.348 | **0.628** |
| Kjøpsloven §39 Heving | 0.910 | 0.334 | **0.622** |

### Filter-støtte (2026-02-06)

Hybrid-søk støtter filtrering uten re-embedding:

```python
search(
    query="miljøkrav",
    doc_type="forskrift",      # Kun forskrifter
    ministry="Klima"           # Kun Klima- og miljødepartementet
)
```

| Filter | Verdier | Matching |
|--------|---------|----------|
| `doc_type` | `"lov"`, `"forskrift"` | Eksakt |
| `ministry` | Fritekst | Partial (ILIKE) |

### Kostnad

| Post | Estimat |
|------|---------|
| Initial embedding (92k seksjoner) | ~$2 (eller gratis kvote) |
| Løpende søk | < $1/mnd |
| Lagring (pgvector) | Inkludert i Supabase |

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Naturlig språk-søk for ikke-jurister |
| Positiv | FTS-fallback ved API-feil |
| Positiv | Filter uten re-embedding |
| Negativ | Avhengighet til Gemini API |
| Negativ | Initial embedding tar ~2 timer |

Se også: `docs/lovdata-vector-search-plan.md` for detaljert implementeringsplan.

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
| `semantisk_sok(query, limit, doc_type, ministry)` | `LovdataVectorSearch.search()` | ✅ |
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

### Alias-oppløsning (2026-02-06)

**Problem:** Manuell vedlikehold av alias-liste skalerer ikke til 4400+ lover/forskrifter.

**Løsning:** Fire-nivå oppløsningsstrategi:

| Nivå | Kilde | Eksempel |
|------|-------|----------|
| 1. Hardkodet | `LOV_ALIASES` dict | `aml` → `LOV-2005-06-17-62` |
| 2. Database | `short_title` i lovdata_documents | `husleieloven` → `lov/1999-03-26-17` |
| 3. Fuzzy | `pg_trgm` trigram matching | `husleielova` → `lov/1999-03-26-17` |
| 4. Direkte | Returner input som-er | `lov/1999-03-26-17` |

**Resultat:** Alle lover/forskrifter kan nå slås opp med naturlig navn:
- `lov("husleieloven")` ✅
- `lov("ferieloven")` ✅
- `lov("romloven")` ✅

### Fuzzy matching (2026-02-06)

**Problem:** Brukere skriver ofte feil (bokmål/nynorsk-endelser, typos).

**Løsning:** PostgreSQL `pg_trgm` extension med trigram similarity:

```sql
-- Finner lignende lovnavn
SELECT * FROM find_similar_law('husleielova', 0.4, 5);
-- Returnerer: Husleieloven (similarity: 0.59)
```

**Testresultater:**

| Input | Fant | Similarity |
|-------|------|------------|
| `husleielova` | Husleieloven | 0.59 |
| `avhendingsloven` | Avhendingslova | 0.65 |
| `arbeidsmiljølov` | Arbeidsmiljøloven | 0.68 |

**Threshold:** 0.4 (40% likhet) - balanserer mellom å fange feil og unngå feil-positiver.

**Minimum lengde:** 8 tegn - korte generiske ord som "loven" (5 tegn) hoppes over for å unngå feil-positiver:

| Input | Lengde | Fuzzy? | Grunn |
|-------|--------|--------|-------|
| `loven` | 5 | ❌ Nei | For kort, matcher "SE-loven" feilaktig |
| `forskrift` | 9 | ✅ Ja | Lang nok |
| `husleielova` | 11 | ✅ Ja | Reell stavefeil |

### Input-validering (2026-02-06)

Alle MCP-verktøy validerer input og gir tydelige feilmeldinger:

| Scenario | Feilmelding |
|----------|-------------|
| `lov("")` | "Lov-ID kan ikke være tom. Oppgi lovnavn eller ID." |
| `sok("")` | "Søkestreng kan ikke være tom. Oppgi ett eller flere søkeord." |
| `hent_flere("aml", [])` | "Paragraf-listen kan ikke være tom. Oppgi minst én paragraf." |

### Innholdsfortegnelse

Når `lov()` eller `forskrift()` kalles **uten paragraf-parameter**, returneres en hierarkisk innholdsfortegnelse:

```
### Innholdsfortegnelse: Arbeidsmiljøloven

**Totalt:** 197 paragrafer (~43,515 tokens)

  **Kapittel 1. Innledende bestemmelser**
    - § 1-1: Lovens formål (199 tok)
    - § 1-2: Hva loven omfatter (311 tok)
    - § 1-3: Virksomhet til havs (336 tok)
    - *... og 6 flere (1065 tok)*
  **Kapittel 2. Arbeidsgivers og arbeidstakers plikter**
    - § 2-1: Arbeidsgivers plikter (23 tok)
    - § 2-2: Arbeidsgivers plikter overfor an... (283 tok)
  **Kapittel 2 A. Varsling**
    - § 2 A-1: Rett til å varsle... (190 tok)
...
```

For forskrifter med deler vises også disse:

```
**Del I. Alminnelige bestemmelser**
  **Kapittel 1. Virkeområde**
    - § 1-1: Hvilke anskaffelser... (59 tok)
```

Dette lar Claude:
- Forstå dokumentets struktur før henting
- Navigere direkte til relevante kapitler/deler
- Estimere token-kostnad per seksjon

### MCP-instruksjoner

Serveren inkluderer instruksjoner som sendes til klienter ved tilkobling:

- **`instructions`** i initialize-respons - automatisk til alle klienter
- **`prompts/get("lovdata-guide")`** - for eksplisitt henting

Instruksjonene dekker:
- Tilgjengelige verktøy og aliaser
- Begrensninger (ingen rettsavgjørelser/forarbeider)
- Brukstips og formatering

### Arbeidsflyt for Claude

**Grunnleggende arbeidsflyt:**

```
1. Velg søkeverktøy:
   - sok("juridisk term") - FTS for eksakte termer
   - semantisk_sok("naturlig språk") - AI for synonymer/naturlig språk

2. Vurder hvilke treff som er relevante basert på snippet

3. lov("anskaffelsesforskriften", "25-2")
   → Hent full tekst for relevant paragraf

4. Presenter svar til bruker med presis lovhenvisning
```

**Utvidet arbeidsflyt med systematisk utforskning:**

```
1. sok(...) eller semantisk_sok(...) → Finn relevante treff
2. lov("lovnavn") UTEN paragraf → Få innholdsfortegnelse
3. Identifiser relevante kapitler/deler fra strukturen
4. hent_flere("lovnavn", ["§ 1", "§ 2", ...]) → Batch-hent
5. Tilby bruker videre utforskning av tilgrensende områder
```

### Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | Claude kan selvstendig finne og hente lovtekst |
| Positiv | Token-effektivt (henter kun det som trengs) |
| Positiv | Presise lovhenvisninger i svar |
| Positiv | Instruksjoner bakt inn i MCP - fungerer fra alle klienter |

### Robusthet og feilhåndtering

**Retry-strategi:** Alle database-operasjoner bruker `@with_retry()` decorator med:
- Exponential backoff (default: 0.5s base, maks 30s)
- Jitter (±25%) for å unngå thundering herd
- Kun transiente feil retries (nettverksfeil, timeout)
- Permanente feil (404, validering) feiler umiddelbart

**Graceful degradation:**
- Vektorsøk faller tilbake til FTS ved Gemini API-feil
- Database-feil returnerer tydelige feilmeldinger, ikke exceptions
- Missing paragraphs rapporteres i batch-respons

**Input-sanitering:**
- Parameteriserte queries (ingen string interpolation)
- WAF blokkerer SQL injection-forsøk
- Tom input returnerer tydelige feilmeldinger

### Testing og edge cases (2026-02-06)

**Sikkerhetstesting:**

| Test | Resultat |
|------|----------|
| SQL injection (`'; DROP TABLE--`) | ✅ WAF blokkerer |
| SQL injection (`1 OR 1=1`) | ✅ Behandles som tekst |
| Path traversal (`../../../etc/passwd`) | ✅ Ingen filsystem-tilgang |
| XSS (`<script>alert('xss')</script>`) | ✅ Behandles som tekst |

**Funksjonell testing:**

| Test | Status | Merknad |
|------|--------|---------|
| Case sensitivity | ✅ Fungerer | `HUSLEIELOVEN` = `husleieloven` |
| Norske tegn (æøå) | ✅ Fungerer | Både input og output |
| Partial match | ⚠️ Upålitelig | Finner ofte feil dokument |
| Stavefeil (fuzzy) | ✅ Fungerer | `husleielova` → husleieloven (min 8 tegn) |
| Batch ugyldig paragraf | ✅ Rapporteres | Viser "Ikke funnet: X, Y" |
| Spesialtegn (§, «») | ✅ Fungerer | |
| Em-dash (–) | ✅ Normaliseres | Konverteres til bindestrek |
| Batch-grense | ✅ Implementert | Maks 50 paragrafer per batch |

**Ytelsesgrenser:**

| Ressurs | Grense | Begrunnelse |
|---------|--------|-------------|
| Batch-størrelse | 50 §§ | ~10k tokens maks, unngår timeout |
| Største lover | 99k tokens | Skatteloven (364 §§) |

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
    address TEXT,  -- id-attributt fra XML (brukes for struktur-matching)
    structure_id UUID REFERENCES lovdata_structure(id) ON DELETE SET NULL,
    char_count INTEGER GENERATED ALWAYS AS (LENGTH(content)) STORED,
    search_vector TSVECTOR,
    embedding VECTOR(1536),     -- Gemini embedding for vektorsøk
    content_hash TEXT,          -- For inkrementell re-embedding
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dok_id, section_id)
)

-- Hierarkisk struktur (Del, Kapittel, Avsnitt, Vedlegg)
lovdata_structure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dok_id TEXT NOT NULL REFERENCES lovdata_documents(dok_id) ON DELETE CASCADE,
    structure_type TEXT NOT NULL CHECK (structure_type IN ('del', 'kapittel', 'avsnitt', 'vedlegg')),
    structure_id TEXT NOT NULL,  -- f.eks. "1", "2 A", "I"
    title TEXT NOT NULL,         -- Full overskrift
    sort_order INTEGER NOT NULL,
    parent_id UUID REFERENCES lovdata_structure(id) ON DELETE CASCADE,
    address TEXT,                -- id-attributt fra XML
    heading_level INTEGER,
    UNIQUE(dok_id, structure_type, structure_id)
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

-- GIN-indeks for fuzzy matching (pg_trgm)
CREATE INDEX idx_lovdata_documents_short_title_trgm ON lovdata_documents
    USING GIN (short_title gin_trgm_ops);

-- B-tree indekser for oppslag
CREATE INDEX idx_lovdata_documents_dok_id ON lovdata_documents(dok_id);
CREATE INDEX idx_lovdata_documents_doc_type ON lovdata_documents(doc_type);
CREATE INDEX idx_lovdata_documents_short_title ON lovdata_documents(short_title);
CREATE INDEX idx_lovdata_sections_dok_section ON lovdata_sections(dok_id, section_id);
CREATE INDEX idx_lovdata_sections_structure ON lovdata_sections(structure_id);
CREATE INDEX idx_lovdata_structure_dok_id ON lovdata_structure(dok_id);
CREATE INDEX idx_lovdata_structure_parent ON lovdata_structure(parent_id);
CREATE INDEX idx_lovdata_structure_type ON lovdata_structure(dok_id, structure_type);

-- IVFFlat-indeks for vektorsøk (pgvector)
-- Valgt over HNSW pga. timeout ved indeksbygging på 90k vektorer
CREATE INDEX lovdata_sections_embedding_ivfflat_idx ON lovdata_sections
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Strukturdata (målt 2026-02-06)

| Struktur-type | Antall |
|---------------|-------:|
| del | 634 |
| kapittel | 11,168 |
| avsnitt | 665 |
| vedlegg | 1,442 |
| **Totalt** | **13,909** |

### Kolonnestørrelser (målt)

| Kolonne | Gjennomsnitt | Merknad |
|---------|--------------|---------|
| content | 498 bytes | Lovtekst |
| search_vector | 419 bytes | tsvector for FTS |
| title | 33 bytes | Paragraftittel |
| dok_id | 23 bytes | Dokument-ID |
| address | ~25 bytes | XML id-attributt (brukes for struktur-matching) |

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
