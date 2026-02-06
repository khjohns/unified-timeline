# Paragraf

MCP-server som gir AI-assistenter tilgang til alle norske lover og forskrifter via [Model Context Protocol](https://modelcontextprotocol.io/).

92 000+ paragrafer fra 770 lover og 3 666 forskrifter — gratis under NLOD 2.0-lisensen.

## Hvorfor

LLM-er hallusinerer lovtekst. Denne serveren gir dem presis, oppdatert norsk rett som verktøykall i stedet for gjetting.

```
Bruker:  "Kan utleier si meg opp?"
AI:      sok("oppsigelse leie") → 4 treff
         lov("husleieloven", "9-7") → full tekst
Svar:    "Etter husleieloven § 9-7 skal oppsigelse fra utleier
          være skriftlig og begrunnet..."
```

## Funksjoner

| Funksjon | Beskrivelse |
|----------|-------------|
| **Lovoppslag** | Slå opp enhver lov/forskrift med kortnavn eller full ID |
| **Fulltekstsøk (FTS)** | PostgreSQL tsvector med norsk stemming, ~6ms |
| **Semantisk søk** | Hybrid vektor+FTS med Gemini embeddings for naturlig språk |
| **Batch-henting** | Hent flere paragrafer i ett kall (~80% raskere) |
| **Innholdsfortegnelse** | Hierarkisk oversikt (Del → Kapittel → §) med token-estimat |
| **Alias-oppløsning** | `aml`, `avhl`, `pbl` + fuzzy matching for stavefeil |
| **OR-fallback** | AND-søk som automatisk faller tilbake til OR ved 0 treff |

## Arkitektur

```
┌──────────────────┐     HTTPS/JSON-RPC      ┌──────────────────────────┐
│  Claude.ai       │ ──────────────────────►  │  Flask Backend           │
│  Copilot Studio  │                          │                          │
│  Gemini AI       │                          │  ┌────────────────────┐  │
│  (MCP-klient)    │ ◄──────────────────────  │  │  MCP Server        │  │
└──────────────────┘                          │  │  (JSON-RPC router) │  │
                                              │  └────────┬───────────┘  │
                                              │           │              │
                                              │  ┌────────▼───────────┐  │
                                              │  │  LovdataService    │  │
                                              │  │  (alias, validering│  │
                                              │  │   formatering)     │  │
                                              │  └────────┬───────────┘  │
                                              │           │              │
                                              └───────────┼──────────────┘
                                                          │
                                        ┌─────────────────┴──────────────────┐
                                        │                                    │
                                        ▼                                    ▼
                              ┌───────────────────┐              ┌───────────────────┐
                              │  Supabase         │              │  Lovdata API       │
                              │  PostgreSQL       │              │  api.lovdata.no    │
                              │                   │              │                    │
                              │  • FTS (GIN)      │              │  Bulk tar.bz2      │
                              │  • pgvector       │              │  (kun ved sync)    │
                              │  • pg_trgm        │              │                    │
                              └───────────────────┘              └───────────────────┘
```

## Hurtigstart

### Forutsetninger

- Python 3.11+
- PostgreSQL med `pgvector` og `pg_trgm` (Supabase anbefalt)
- Valgfritt: Gemini API-nøkkel for semantisk søk

### Installasjon

```bash
git clone <repo-url>
cd paragraf

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Konfigurasjon

```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Valgfritt: for semantisk søk
GEMINI_API_KEY=AIza...
```

Uten Supabase brukes SQLite som lokal fallback.

### Kjør databasemigreringer

```bash
# Kjør mot Supabase (i rekkefølge)
supabase db push
```

Migreringene oppretter:
- `lovdata_documents` — lover og forskrifter
- `lovdata_sections` — paragrafer med FTS og embedding
- `lovdata_structure` — hierarkisk struktur (del/kapittel/avsnitt)
- `lovdata_sync_meta` — sync-metadata
- SQL-funksjoner for søk og fuzzy matching

### Synkroniser lovdata

```bash
# Første gang (tar 5-10 min, laster ned ~200MB)
python -c "
from services.lovdata_service import LovdataService
svc = LovdataService()
svc.sync()
"
```

### Start serveren

```bash
# Utvikling
flask run --port 8000

# Produksjon
gunicorn app:app --bind 0.0.0.0:8000
```

### Koble til Claude.ai

1. Gå til **Settings → Connectors → Add custom connector**
2. URL: `https://your-domain.com/mcp/`
3. Ferdig — ingen autentisering kreves

## MCP-verktøy

| Verktøy | Beskrivelse | Eksempel |
|---------|-------------|----------|
| `lov` | Slå opp lov | `lov("aml", "14-9")` |
| `forskrift` | Slå opp forskrift | `forskrift("foa", "25-2")` |
| `sok` | Fulltekstsøk | `sok("mangel bolig")` |
| `semantisk_sok` | AI-drevet søk | `semantisk_sok("skjulte feil i boligen")` |
| `hent_flere` | Batch-henting | `hent_flere("aml", ["14-9", "15-6"])` |
| `sjekk_storrelse` | Token-estimat | `sjekk_storrelse("skatteloven", "5-1")` |
| `liste` | Vis aliaser | `liste()` |
| `status` | Sync-status | `status()` |
| `sync` | Synkroniser | `sync(force=True)` |

### Alias-oppløsning

Fire nivåer for å finne riktig lov:

| Nivå | Eksempel |
|------|----------|
| 1. Hardkodet alias | `aml` → `LOV-2005-06-17-62` |
| 2. Database (short_title) | `husleieloven` → `lov/1999-03-26-17` |
| 3. Fuzzy (pg_trgm) | `husleielova` → husleieloven (similarity: 0.59) |
| 4. Direkte ID | `lov/1999-03-26-17` → brukes som-er |

### Søkesyntaks (FTS)

| Syntaks | Eksempel | Betydning |
|---------|----------|-----------|
| Standard | `mangel bolig` | AND (begge ord) |
| OR | `miljø OR klima` | Minst ett ord |
| Frase | `"vesentlig mislighold"` | Eksakt frase |
| Ekskludering | `mangel -bil` | mangel, ikke bil |

AND-søk som gir 0 treff faller automatisk tilbake til OR.

## Mappestruktur

```
├── mcp/
│   ├── __init__.py              # Modul-eksport
│   └── server.py                # MCP JSON-RPC server (9 verktøy)
├── routes/
│   └── mcp_routes.py            # Flask blueprint, HTTP transport
├── services/
│   ├── lovdata_service.py       # Forretningslogikk, aliaser, validering
│   ├── lovdata_supabase.py      # Supabase PostgreSQL backend
│   ├── lovdata_sync.py          # SQLite fallback + sync fra API
│   ├── lovdata_structure_parser.py  # XML → hierarkisk struktur
│   └── lovdata_vector_search.py # Hybrid vektor+FTS søk
├── scripts/
│   └── embed_lovdata.py         # Generer embeddings for vektorsøk
└── migrations/
    ├── 20260203_create_lovdata_tables.sql
    ├── 20260204_add_vector_search.sql
    ├── 20260205_improve_search_snippets.sql
    ├── 20260205_websearch_tsquery.sql
    ├── 20260206_add_lovdata_structure.sql
    ├── 20260206_add_vector_search_filters.sql
    ├── 20260206_fts_or_fallback.sql
    └── ...
```

## API-endepunkter

| Metode | Sti | Beskrivelse |
|--------|-----|-------------|
| `POST` | `/mcp/` | MCP JSON-RPC (hovedendepunkt) |
| `HEAD` | `/mcp/` | Protokollversjon-sjekk |
| `GET`  | `/mcp/` | SSE-stream (bakoverkompatibilitet) |
| `GET`  | `/mcp/health` | Helsesjekk |
| `GET`  | `/mcp/info` | Serverinfo og verktøyliste |

## Ytelse

| Metrikk | Verdi |
|---------|-------|
| FTS-søk (warm cache) | ~6ms |
| FTS-søk (cold cache) | ~600ms |
| Lovoppslag | ~50-200ms |
| Batch 3 paragrafer | ~100ms (vs 491ms separat) |
| Database-størrelse | ~160MB tabell + 42MB TOAST + 37MB GIN |
| Vektorsøk (hybrid) | ~200-500ms (inkl. embedding) |

## Datamodell

### Tabeller

```
lovdata_documents (4 439 rader)
├── dok_id TEXT UNIQUE        "lov/2005-05-20-28"
├── title TEXT                "Lov om arbeidsmiljø..."
├── short_title TEXT          "Arbeidsmiljøloven"
├── doc_type TEXT             "lov" | "forskrift"
├── ministry TEXT             "Arbeids- og inkluderingsdepartementet"
└── search_vector TSVECTOR

lovdata_sections (92 130 rader)
├── dok_id + section_id       UNIQUE
├── content TEXT               Paragraftekst
├── search_vector TSVECTOR     Norsk stemming
├── embedding VECTOR(1536)     Gemini embedding
├── char_count INTEGER         GENERATED ALWAYS
└── structure_id UUID FK       → lovdata_structure

lovdata_structure (13 909 rader)
├── structure_type TEXT        "del" | "kapittel" | "avsnitt" | "vedlegg"
├── title TEXT                 "Kapittel 2. Arbeidsgivers plikter"
├── parent_id UUID FK          Hierarkisk (self-ref)
└── sort_order INTEGER
```

### Indekser

- **GIN** på `search_vector` — fulltekstsøk
- **GIN** på `short_title` med `pg_trgm` — fuzzy matching
- **IVFFlat** på `embedding` (lists=100) — vektorsøk
- **B-tree** på `dok_id`, `section_id`, `structure_id` — oppslag

## Sikkerhet

- **Ingen brukerdata lagres** — authless design
- **Parameteriserte queries** — ingen SQL injection
- **Input-validering** på alle MCP-verktøy
- **Rate limiting** anbefalt i produksjon (flask-limiter)
- **NLOD 2.0-lisens** — alle data er offentlige

### Testet mot

| Angrep | Resultat |
|--------|----------|
| SQL injection (`'; DROP TABLE--`) | Blokkert |
| Path traversal (`../../../etc/passwd`) | Ingen filsystem-tilgang |
| XSS (`<script>alert('xss')</script>`) | Behandlet som tekst |

## Begrensninger

### Inkludert (gratis via Lovdata Public API)

- Gjeldende lover (770+)
- Sentrale forskrifter (3 666+)
- Lokale forskrifter, delegeringer, instrukser

### IKKE inkludert

- Rettsavgjørelser (Høyesterett, lagmannsrett) — krever Lovdata Pro
- Forarbeider (NOU, Prop., Ot.prp.) — krever Lovdata Pro
- Juridiske artikler

## Deploy

### Render

```yaml
# render.yaml
services:
  - type: web
    name: paragraf
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app --bind 0.0.0.0:$PORT
    healthCheckPath: /mcp/health
```

### Miljøvariabler

| Variabel | Påkrevd | Beskrivelse |
|----------|---------|-------------|
| `SUPABASE_URL` | Ja* | Supabase prosjekt-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Ja* | Service role nøkkel |
| `GEMINI_API_KEY` | Nei | For semantisk søk |
| `MCP_REQUIRE_AUTH` | Nei | `true` for OAuth 2.1 |
| `LOVDATA_CACHE_DIR` | Nei | SQLite cache-sti (default: `/tmp/lovdata-cache`) |

\* SQLite brukes som fallback uten Supabase.

## Utvikling

```bash
# Kjør tester
cd backend && make test

# Generer embeddings (krever GEMINI_API_KEY)
python scripts/embed_lovdata.py

# Helsesjekk
curl http://localhost:8000/mcp/health

# Test MCP-kall
curl -X POST http://localhost:8000/mcp/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "lov",
      "arguments": {"lov_id": "aml", "paragraf": "14-9"}
    }
  }'
```

## Teknologi

| Komponent | Teknologi |
|-----------|-----------|
| Server | Flask + Python 3.11 |
| Database | Supabase PostgreSQL (SQLite fallback) |
| Fulltekstsøk | PostgreSQL tsvector + GIN |
| Vektorsøk | pgvector IVFFlat + Gemini embeddings |
| Fuzzy matching | pg_trgm |
| Protokoll | MCP 2025-06-18, Streamable HTTP |
| Datakilde | Lovdata Public API (NLOD 2.0) |

## Lisens

Inneholder data under Norsk lisens for offentlige data ([NLOD 2.0](https://data.norge.no/nlod/no/2.0)) tilgjengeliggjort av [Lovdata](https://lovdata.no).

## Relatert dokumentasjon

- [ADR-003: Arkitekturbeslutninger](docs/ADR-003-lovdata-mcp.md) — alle arkitekturbeslutninger
- [Dataflytdiagram](docs/lovdata-mcp-dataflyt.md) — sikkerhet og nettverksmodell
- [Vektorsøk-plan](docs/lovdata-vector-search-plan.md) — semantisk søk i detalj
- [MCP Apps-plan](docs/lovdata-mcp-apps-plan.md) — interaktiv UI-roadmap
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-06-18)
- [Lovdata Public API](https://api.lovdata.no/)
